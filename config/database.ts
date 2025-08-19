export default () => ({
  connection: {
    client: 'postgres',
    connection: {
      connectionString: 'postgresql://postgres:QefoouZSrtkCUeHCdxSwUWttoqSMqJEh@tramway.proxy.rlwy.net:40273/railway',
      ssl: { rejectUnauthorized: false },
    },
    acquireConnectionTimeout: 60000,
  },
});
