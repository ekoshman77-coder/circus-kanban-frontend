export interface INoteJson {
  id?: string;
  userId: string;
  title: string;
  content: string;
  colorType: string;
  tag?: string;
  isInCalculation?: boolean;
}
