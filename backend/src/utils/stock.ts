export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function nextBalance(balance: number, quantity: number, type: 'IN' | 'OUT') {
  if (!Number.isSafeInteger(quantity) || quantity <= 0)
    throw new AppError(400, 'Quantidade deve ser um inteiro positivo.');
  const result = balance + (type === 'IN' ? quantity : -quantity);
  if (result < 0) throw new AppError(409, 'Saldo insuficiente para esta saída.');
  if (!Number.isSafeInteger(result) || result > 2147483647)
    throw new AppError(400, 'Quantidade excede o limite permitido.');
  return result;
}
