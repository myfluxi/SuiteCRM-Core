import {Record} from '@app-common/record/record.model';
import {deepClone} from '@base/utils/object-utils';
import {BehaviorSubject, Observable, Subscription, throwError} from 'rxjs';
import {catchError, map, shareReplay, tap} from 'rxjs/operators';
import {LanguageStore} from '@store/language/language.store';
import {ViewFieldDefinition} from '@app-common/metadata/metadata.model';
import {Field, FieldManager, FieldMap} from '@app-common/record/field.model';
import {RecordFetchGQL} from '@store/record/graphql/api.record.get';
import {RecordSaveGQL} from '@store/record/graphql/api.record.save';
import {MessageService} from '@services/message/message.service';

const initialState = {
    id: '',
    type: '',
    module: '',
    attributes: {}
} as Record;

export class RecordManager {

    state$: Observable<Record>;
    staging$: Observable<Record>;
    protected cache$: Observable<any> = null;
    protected internalState: Record = deepClone(initialState);
    protected stagingState: Record = deepClone(initialState);
    protected store = new BehaviorSubject<Record>(this.internalState);
    protected staging = new BehaviorSubject<Record>(this.stagingState);
    protected definitions: ViewFieldDefinition[] = [];
    protected subs: Subscription[] = [];
    protected fieldsMetadata = {
        fields: [
            '_id',
            'id',
            'attributes',
            'module',
            'type',
        ]
    };

    constructor(
        protected language: LanguageStore,
        protected definitions$: Observable<ViewFieldDefinition[]>,
        protected recordSaveGQL: RecordSaveGQL,
        protected recordFetchGQL: RecordFetchGQL,
        protected message: MessageService
    ) {
        this.state$ = this.store.asObservable().pipe(
            tap(record => {
                this.updateStaging(deepClone(record));
            })
        );
        this.staging$ = this.staging.asObservable();

        this.subs.push(definitions$.subscribe(definitions => {
            this.definitions = definitions;
            this.init(this.internalState);
        }));
    }

    init(record: Record): void {
        const newRecord = {
            ...record,
        };

        if (record.module && this.definitions && this.definitions.length > 0) {
            newRecord.fields = this.initFields(record, this.definitions);
        }

        this.updateState(newRecord);
    }

    save(): Observable<Record> {

        Object.keys(this.stagingState.fields).forEach(fieldName => {
            const field = this.stagingState.fields[fieldName];

            const type = field.type || '';
            const source = field.definition.source || '';
            const rname = field.definition.rname || '';
            const idName = field.definition.id_name || '';

            if (type === 'relate' && source === 'non-db' && idName === fieldName) {
                this.stagingState.attributes[fieldName] = field.value;
                return;
            }

            if (type === 'relate' && source === 'non-db' && rname !== '') {
                this.stagingState.attributes[fieldName][rname] = field.value;
                return;
            }

            this.stagingState.attributes[fieldName] = field.value;
        });

        return this.recordSaveGQL.save(this.stagingState).pipe(
            tap((record: Record) => {
                if (record.module && this.definitions && this.definitions.length > 0) {
                    record.fields = this.initFields(record, this.definitions);
                }
                this.updateState(record);
            })
        );
    }

    resetStaging(): void {
        this.updateStaging(deepClone(this.internalState));
    }

    destroy(): void {
        this.subs.forEach(sub => sub.unsubscribe());
    }

    /**
     * Get record
     *
     * @returns {object} Record
     */
    getRecord(): Record {
        if (!this.internalState) {
            return null;
        }
        return deepClone(this.internalState);
    }

    /**
     * Get record cached Observable or call the backend
     *
     * @param {string} module to use
     * @param {string} recordId to use
     * @param {boolean} useCache if to use cache
     * @returns {object} Observable<any>
     */
    public retrieveRecord(
        module: string,
        recordId: string,
        useCache = true
    ): Observable<Record> {
        if (this.cache$ == null || useCache === false) {
            this.cache$ = this.fetch(module, recordId).pipe(
                tap(record => this.init(record)),
                shareReplay(1)
            );
        }
        return this.cache$;
    }

    /**
     * Internal API
     */

    /**
     * Init Fields
     *
     * @param {object} record to use
     * @param {object} viewFieldDefinitions to use
     * @returns {object} fields
     */
    protected initFields(record: Record, viewFieldDefinitions: ViewFieldDefinition[]): FieldMap {
        const fields = {} as FieldMap;

        viewFieldDefinitions.forEach(viewField => {
            if (!viewField) {
                return;
            }
            fields[viewField.name] = this.buildField(viewField, record, this.language);
        });

        return fields;
    }

    /**
     * Build Field
     *
     * @param {object} viewField to use
     * @param {object} record to use
     * @param {object} language to use
     * @returns {object} field
     */
    protected buildField(viewField: ViewFieldDefinition, record: Record, language: LanguageStore): Field {
        return FieldManager.buildField(record, viewField, language);
    }

    /**
     * Update the state
     *
     * @param {object} state to set
     */
    protected updateState(state: Record): void {
        this.store.next(this.internalState = state);
    }

    /**
     * Update the staging
     *
     * @param {object} state to set
     */
    protected updateStaging(state: Record): void {
        this.staging.next(this.stagingState = state);
    }

    /**
     * Fetch the record from the backend
     *
     * @param {string} module to use
     * @param {string} recordID to use
     * @returns {object} Observable<any>
     */
    protected fetch(module: string, recordID: string): Observable<Record> {
        return this.recordFetchGQL.fetch(module, recordID, this.fieldsMetadata)
            .pipe(
                map(({data}) => {

                    const record: Record = {
                        type: '',
                        module: '',
                        attributes: {}
                    } as Record;

                    if (!data) {
                        return record;
                    }

                    const id = data.getRecord.attributes.id;
                    if (!id) {
                        this.message.addDangerMessageByKey('LBL_RECORD_DOES_NOT_EXIST');
                        return record;
                    }

                    record.id = id;
                    record.module = module;
                    record.type = data.getRecord.attributes && data.getRecord.attributes.object_name;
                    record.attributes = data.getRecord.attributes;

                    return record;
                }),
                catchError(err => throwError(err)),
            );
    }
}