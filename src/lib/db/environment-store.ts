import EventEmitter from 'events';
import { Knex } from 'knex';
import { Logger, LogProvider } from '../logger';
import metricsHelper from '../util/metrics-helper';
import { DB_TIME } from '../metric-events';
import { IEnvironment, IEnvironmentCreate } from '../types/model';
import NotFoundError from '../error/notfound-error';
import { IEnvironmentStore } from '../types/stores/environment-store';
import { snakeCaseKeys } from '../util/snakeCase';

interface IEnvironmentsTable {
    name: string;
    display_name: string;
    created_at?: Date;
    type: string;
    sort_order: number;
    enabled: boolean;
    protected: boolean;
}

const COLUMNS = [
    'type',
    'display_name',
    'name',
    'created_at',
    'sort_order',
    'enabled',
    'protected',
];

function mapRow(row: IEnvironmentsTable): IEnvironment {
    return {
        name: row.name,
        displayName: row.display_name,
        type: row.type,
        sortOrder: row.sort_order,
        enabled: row.enabled,
        protected: row.protected,
    };
}

const TABLE = 'environments';

export default class EnvironmentStore implements IEnvironmentStore {
    private logger: Logger;

    private db: Knex;

    private timer: (string) => any;

    constructor(db: Knex, eventBus: EventEmitter, getLogger: LogProvider) {
        this.db = db;
        this.logger = getLogger('db/environment-store.ts');
        this.timer = (action) =>
            metricsHelper.wrapTimer(eventBus, DB_TIME, {
                store: 'environment',
                action,
            });
    }

    async deleteAll(): Promise<void> {
        await this.db(TABLE).del();
    }

    async get(key: string): Promise<IEnvironment> {
        const row = await this.db<IEnvironmentsTable>(TABLE)
            .where({ name: key })
            .first();
        if (row) {
            return mapRow(row);
        }
        throw new NotFoundError(`Could not find environment with name: ${key}`);
    }

    async getAll(): Promise<IEnvironment[]> {
        const rows = await this.db<IEnvironmentsTable>(TABLE)
            .select('*')
            .orderBy('sort_order', 'created_at');
        return rows.map(mapRow);
    }

    async exists(name: string): Promise<boolean> {
        const result = await this.db.raw(
            `SELECT EXISTS (SELECT 1 FROM ${TABLE} WHERE name = ?) AS present`,
            [name],
        );
        const { present } = result.rows[0];
        return present;
    }

    async getByName(name: string): Promise<IEnvironment> {
        const row = await this.db<IEnvironmentsTable>(TABLE)
            .where({ name })
            .first();
        if (!row) {
            throw new NotFoundError(
                `Could not find environment with name ${name}`,
            );
        }
        return mapRow(row);
    }

    async updateProperty(
        id: string,
        field: string,
        value: string | number,
    ): Promise<void> {
        await this.db<IEnvironmentsTable>(TABLE)
            .update({
                [field]: value,
            })
            .where({ name: id, protected: false });
    }

    async updateSortOrder(id: string, value: number): Promise<void> {
        await this.db<IEnvironmentsTable>(TABLE)
            .update({
                sort_order: value,
            })
            .where({ name: id });
    }

    async update(
        env: Pick<IEnvironment, 'displayName' | 'type' | 'protected'>,
        name: string,
    ): Promise<IEnvironment> {
        const updatedEnv = await this.db<IEnvironmentsTable>(TABLE)
            .update(snakeCaseKeys(env))
            .where({ name, protected: false })
            .returning<IEnvironmentsTable>(COLUMNS);

        return mapRow(updatedEnv[0]);
    }

    async create(env: IEnvironmentCreate): Promise<IEnvironment> {
        const row = await this.db<IEnvironmentsTable>(TABLE)
            .insert(snakeCaseKeys(env))
            .returning<IEnvironmentsTable>(COLUMNS);

        return mapRow(row[0]);
    }

    async delete(name: string): Promise<void> {
        await this.db(TABLE).where({ name, protected: false }).del();
    }

    destroy(): void {}
}
