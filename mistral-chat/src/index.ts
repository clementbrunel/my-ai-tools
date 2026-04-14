#!/usr/bin/env node
import { program } from 'commander';
import chalk from 'chalk';
import { getMistralCookies, parseCookieString } from './auth/cookie-store.js';
import type { CookieMap } from './auth/cookie-store.js';
import { MistralClient } from './api/client.js';
import { startRepl } from './repl/loop.js';

program
  .name('mistral-chat')
  .description('REPL interactif pour l\'instance Mistral d\'entreprise (auth via cookies navigateur)')
  .version('0.1.0')
  .option('--browser <name>', 'Navigateur source des cookies : chrome | edge', 'chrome')
  .option('--profile <name>', 'Profil Chrome/Edge à utiliser', 'Default')
  .option(
    '--cookie <string>',
    'Coller directement la valeur du header Cookie (depuis DevTools → Network → Request Headers → "Cookie:")',
  )
  .option(
    '--bearer <token>',
    'Bearer token JWT (depuis DevTools → Network → Request Headers → "Authorization: Bearer ...")',
  )
  .option('--debug', 'Afficher les requêtes HTTP brutes', false);

program.parse(process.argv);

const opts = program.opts<{
  browser: string;
  profile: string;
  cookie?: string;
  bearer?: string;
  debug: boolean;
}>();

async function main(): Promise<void> {
  let cookies: CookieMap;

  if (opts.cookie) {
    // Manual mode: user pasted cookie string from DevTools
    cookies = parseCookieString(opts.cookie);
    const count = Object.keys(cookies).length;
    console.log(chalk.green(`✓ ${count} cookie(s) chargé(s) depuis --cookie`));
  } else {
    console.log(chalk.gray(`Lecture des cookies ${opts.browser} (profil: ${opts.profile})...`));
    try {
      cookies = await getMistralCookies(opts.browser, opts.profile, opts.debug);
      const count = Object.keys(cookies).length;
      console.log(chalk.green(`✓ ${count} cookie(s) chargé(s)`));
    } catch (err) {
      console.error(chalk.red.bold('Erreur d\'authentification :'));
      console.error(chalk.red(String(err)));
      console.error('');
      console.error(chalk.yellow('💡 Alternative : colle tes cookies manuellement via DevTools :'));
      console.error(chalk.gray(`   F12 → Network → requête vers ${process.env['CHAT_MISTRAL_URL'] ?? ''}`));
      console.error(chalk.gray('   → Request Headers → copier la valeur de "Cookie:"'));
      console.error(chalk.cyan('   npm start -- --cookie "token=xxx; session=yyy; ..."'));
      process.exit(1);
    }
  }

  if (opts.debug) {
    console.log(chalk.gray('Cookies (noms) :'));
    for (const name of Object.keys(cookies)) {
      console.log(chalk.gray(`  · ${name}`));
    }
  }

  const client = new MistralClient({ cookies, bearerToken: opts.bearer, debug: opts.debug });
  await startRepl(client);
}

try {
  await main();
} catch (err: unknown) {
  const message = err instanceof Error ? err.message : JSON.stringify(err);
  console.error(chalk.red('Erreur fatale :'), message);
  process.exit(1);
}
