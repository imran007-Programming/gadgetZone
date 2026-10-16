/**
 * Guard for scripts that wipe data (seed, catalog reset, gallery reset).
 * DATABASE_URL may point at the live database, so these refuse to run unless
 * the host is local (localhost, 127.0.0.1 or the docker-compose "db" service),
 * or --force-remote is passed on purpose.
 */
export function assertLocalDatabase(script: string) {
  const url = process.env.DATABASE_URL ?? '';
  const host = url.replace(/^.*@/, '').replace(/[:/?].*$/, '');
  const local = ['localhost', '127.0.0.1', 'db'].includes(host);
  if (!local && !process.argv.includes('--force-remote')) {
    console.error(
      `${script} deletes data, and DATABASE_URL points at "${host}", which is not a local database. ` +
        'Refusing to run. Point DATABASE_URL at a local database, or pass --force-remote if you really mean it.',
    );
    process.exit(1);
  }
}
