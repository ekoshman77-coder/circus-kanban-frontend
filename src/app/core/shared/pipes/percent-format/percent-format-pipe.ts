import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'percentFormat',
})
export class PercentFormatPipe implements PipeTransform {

transform(
  value: number | string | null | undefined,
  digits: number = 0,
  useSpace: boolean = true
): string {
  // Wenn value null oder undefined ist, machen wir einen leeren String daraus
  const cleanValue = value ?? '';

  if (cleanValue === '') {
    return '';
  }

  const num = typeof cleanValue === 'string' ? parseFloat(cleanValue) : cleanValue;
  
  if (isNaN(num)) {
    return cleanValue.toString();
  }

  const suffix = useSpace ? " %" : "%"

  let formattedNumber: string = (digits === 0)
       ? Math.round(num) + suffix
       : num.toFixed(digits).replace('.', ',') + suffix
   
  return formattedNumber;
  }
}
