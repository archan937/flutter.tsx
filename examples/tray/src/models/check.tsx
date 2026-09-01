export interface Check {
  id: number;
  label: string;
  url: string;
  lastMs: number;
  ok: boolean;
}
