// This is a placeholder for your database configuration.
// Replace the connection details with your actual database credentials.
export default {
  development: {
    client: 'pg',
    connection: {
      host: '127.0.0.1',
      port: 5432,
      user: 'your_db_user',
      password: 'your_db_password',
      database: 'storefront_dev',
    },
    migrations: {
      tableName: 'knex_migrations',
      directory: './sql/migrations',
    },
  },
  // You can add more environments like production, staging, etc.
};
