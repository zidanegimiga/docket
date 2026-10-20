export interface DatabaseProvider<TClient> {
  readonly client: TClient;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  healthCheck(): Promise<boolean>;
}
