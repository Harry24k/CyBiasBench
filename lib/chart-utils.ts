/* eslint-disable @typescript-eslint/no-explicit-any */

export function pctFormatter(value: any): string {
  return `${(Number(value) * 100).toFixed(1)}%`;
}

export function pctFormatter0(value: any): string {
  return `${(Number(value) * 100).toFixed(0)}%`;
}

export function dollarFormatter(value: any): string {
  return `$${Number(value).toFixed(2)}`;
}

export function dollarFormatter4(value: any): string {
  return `$${Number(value).toFixed(4)}`;
}

export function tokenFormatter(value: any): string {
  return `${Number(value).toLocaleString()} tokens`;
}

export function tokenKFormatter(value: any): string {
  return `${(Number(value) / 1000).toFixed(0)}k`;
}

export function numFormatter2(value: any): string {
  return Number(value).toFixed(2);
}

export function numFormatter4(value: any): string {
  return Number(value).toFixed(4);
}

export function msFormatter(value: any): string {
  return `${Number(value).toFixed(0)}ms`;
}

export function numFormatter0(value: any): string {
  return Number(value).toFixed(0);
}

export function labelFormatter(labels: Record<string, string>) {
  return (value: any) => labels[value] ?? value;
}
