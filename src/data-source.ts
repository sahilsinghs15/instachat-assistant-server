import { DataSource, DataSourceOptions } from 'typeorm';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config();

const isCompiled = __filename.endsWith('.js');

const options: DataSourceOptions = {
    type: 'postgres',
    url: process.env.DATABASE_URL, 
    ssl: {
        rejectUnauthorized: false,
    },

    // Entity & Migration paths
    entities: isCompiled
        ? [path.join(__dirname, 'entities', '**', '*.js')]
        : [path.join(__dirname, 'entities', '**', '*.ts')],

    migrations: isCompiled
        ? [path.join(__dirname, 'migrations', '**', '*.js')]
        : [path.join(__dirname, 'migrations', '**', '*.ts')],

    synchronize: false, 
    logging: process.env.NODE_ENV === 'development',
    
    // Connection pooling optimized for serverless/cloud environments
    extra: {
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
    }
};

const AppDataSource = new DataSource(options);

export default AppDataSource;