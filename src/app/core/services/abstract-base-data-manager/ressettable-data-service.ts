export interface ResettableDataService {
  resetData(): void;
  checkUnsavedData?(): string | null; // Optional im Interface, damit alte Services nicht meckern
}