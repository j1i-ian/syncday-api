export interface DataSourceMock {
    getRepository: any;
    transaction: (callback: any) => any;
    setQuery: (stubValue: any) => any;
    query: (queryString: string) => Promise<any>;
}
