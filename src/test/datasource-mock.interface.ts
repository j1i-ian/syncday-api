export interface DataSourceMock {
    getRepository: any;
    transaction: (callback: any) => any;
}
