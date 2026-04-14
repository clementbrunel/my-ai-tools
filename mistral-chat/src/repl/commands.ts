import chalk from 'chalk';
import type { MistralClient } from '../api/client.js';
import type { Conversation, ConversationWithMessages } from '../api/conversations.js';
import { listConversations, getConversation } from '../api/conversations.js';

export interface ReplState {
  client: MistralClient;
  activeConversation: Conversation | null;
}

export type CommandResult = { type: 'continue' } | { type: 'exit' };

export async function handleCommand(input: string, state: ReplState): Promise<CommandResult> {
  const [cmd, ...args] = input.trim().slice(1).split(/\s+/);
  const command = cmd?.toLowerCase() ?? '';

  switch (command) {
    case 'exit': case 'quit': case 'q':
      return { type: 'exit' };

    case 'help': case 'h':
      printHelp();
      return { type: 'continue' };

    case 'list': case 'ls':
      await cmdList(state);
      return { type: 'continue' };

    case 'resume': case 'r': {
      const id = args[0];
      if (!id) { console.log(chalk.red('Usage: /resume <id>')); return { type: 'continue' }; }
      await cmdResume(state, id);
      return { type: 'continue' };
    }

    case 'new': case 'n':
      console.log(chalk.gray('Tape ton message pour démarrer une nouvelle conversation.'));
      state.activeConversation = null;
      return { type: 'continue' };

    default:
      console.log(chalk.red(`Commande inconnue: /${command}. Tape /help.`));
      return { type: 'continue' };
  }
}

function printHelp(): void {
  console.log('');
  console.log(chalk.bold('Commandes :'));
  console.log(`  ${chalk.cyan('/list')}              Lister les conversations récentes`);
  console.log(`  ${chalk.cyan('/new')}               Réinitialiser (nouvelle conversation)`);
  console.log(`  ${chalk.cyan('/resume <id>')}       Reprendre une conversation existante`);
  console.log(`  ${chalk.cyan('/help')}              Afficher cette aide`);
  console.log(`  ${chalk.cyan('/exit')}              Quitter`);
  console.log('');
  console.log(chalk.gray('Tout autre texte est envoyé comme message.'));
  console.log('');
}

async function cmdList(state: ReplState): Promise<void> {
  try {
    console.log(chalk.gray('Chargement...'));
    const conversations = await listConversations(state.client);

    if (conversations.length === 0) {
      console.log(chalk.yellow('Aucune conversation trouvée.'));
      return;
    }

    console.log('');
    console.log(chalk.bold(`${conversations.length} conversation(s) :`));
    for (const conv of conversations.slice(0, 20)) {
      const isActive = state.activeConversation?.id === conv.id;
      const marker = isActive ? chalk.green(' ◀') : '';
      const title = conv.title ?? chalk.gray('(sans titre)');
      const date = conv.updatedAt ?? conv.createdAt ?? '';
      const dateStr = date ? chalk.gray(` · ${formatDate(String(date))}`) : '';
      console.log(`  ${chalk.cyan(conv.id.substring(0, 8))}…  ${title}${dateStr}${marker}`);
    }
    if (conversations.length > 20) {
      console.log(chalk.gray(`  … et ${conversations.length - 20} autres`));
    }
    console.log('');
  } catch (err) {
    console.log(chalk.red(`Erreur listing : ${String(err)}`));
  }
}

async function cmdResume(state: ReplState, id: string): Promise<void> {
  try {
    console.log(chalk.gray(`Chargement conversation ${id}...`));
    const conv: ConversationWithMessages = await getConversation(state.client, id);
    state.activeConversation = conv;

    console.log(chalk.green(`✓ "${conv.title ?? id}" chargée.`));

    const recent = (conv.messages ?? []).slice(-6);
    if (recent.length > 0) {
      console.log(chalk.gray(`--- ${conv.messages.length} message(s), ${recent.length} derniers ---`));
      for (const msg of recent) printMessage(msg.role, msg.content);
    }
    console.log('');
  } catch (err) {
    console.log(chalk.red(`Erreur résumé : ${String(err)}`));
  }
}

export function printMessage(role: string, content: string): void {
  if (role === 'user') {
    console.log(chalk.cyan.bold('Vous : ') + content);
  } else if (role === 'assistant') {
    console.log(chalk.green.bold('Mistral : ') + content);
  } else {
    console.log(chalk.gray(`[${role}] `) + content);
  }
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}
