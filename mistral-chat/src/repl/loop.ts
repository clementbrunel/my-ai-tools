import chalk from 'chalk';
import { input } from '@inquirer/prompts';
import type { MistralClient } from '../api/client.js';
import { AuthError } from '../api/client.js';
import { newChat, sendMessage } from '../api/messages.js';
import { handleCommand, printMessage } from './commands.js';
import type { ReplState } from './commands.js';

export async function startRepl(client: MistralClient): Promise<void> {
  const state: ReplState = { client, activeConversation: null };

  try { await client.bootstrap(); } catch { /* non-fatal */ }

  printBanner();

  while (true) {
    const userInput = await readInput(state);
    if (userInput === null) break;

    const trimmed = userInput.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('/')) {
      const result = await handleCommand(trimmed, state);
      if (result.type === 'exit') break;
      continue;
    }

    const shouldContinue = await handleMessage(trimmed, state, client);
    if (!shouldContinue) break;
  }

  console.log('');
  console.log(chalk.gray('Au revoir !'));
}

function printBanner(): void {
  console.log('');
  console.log(chalk.bold.green('╔══════════════════════════════════════╗'));
  console.log(chalk.bold.green('║  Mistral Chat — Instance Entreprise  ║'));
  console.log(chalk.bold.green('╚══════════════════════════════════════╝'));
  console.log('');
  console.log(chalk.gray('Tape /help pour voir les commandes disponibles.'));
  console.log(chalk.gray('Tape /new ou envoie directement un message pour démarrer.'));
  console.log('');
}

async function readInput(state: ReplState): Promise<string | null> {
  const activeTitle = state.activeConversation
    ? chalk.cyan(`[${(state.activeConversation.title ?? state.activeConversation.id.substring(0, 8)).substring(0, 30)}]`)
    : chalk.gray('[nouvelle conversation]');

  try {
    return await input({ message: `${activeTitle} ›` });
  } catch {
    return null; // Ctrl+C or Ctrl+D
  }
}

async function handleMessage(
  text: string,
  state: ReplState,
  client: MistralClient,
): Promise<boolean> {
  try {
    console.log(chalk.gray('Envoi...'));

    if (state.activeConversation) {
      const reply = await sendMessage(client, state.activeConversation.id, text);
      console.log('');
      printMessage('user', text);
      printMessage('assistant', reply);
      console.log('');
    } else {
      // newChat creates the conversation AND sends the first message in one tRPC call
      const result = await newChat(client, text);
      state.activeConversation = { id: result.chatId };
      console.log('');
      printMessage('user', text);
      printMessage('assistant', result.assistantContent);
      console.log('');
    }
    return true;
  } catch (err) {
    if (err instanceof AuthError) {
      console.log('');
      console.log(chalk.red.bold('⚠  Erreur d\'authentification'));
      console.log(chalk.red(err.message));
      console.log('');
      return false;
    }
    console.log(chalk.red(`Erreur : ${String(err)}`));
    return true;
  }
}
