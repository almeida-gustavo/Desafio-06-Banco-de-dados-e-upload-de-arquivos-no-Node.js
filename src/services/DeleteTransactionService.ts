import { getRepository } from 'typeorm';

import Transcation from '../models/Transaction';
import AppError from '../errors/AppError';

interface RequestDTO {
  id: string;
}

class DeleteTransactionService {
  public async execute({ id }: RequestDTO): Promise<void> {
    const transactionRepository = getRepository(Transcation);
    const transaction = await transactionRepository.findOne({
      where: { id },
    });

    if (!transaction) {
      throw new AppError('Transaction does not exists');
    }

    transactionRepository.delete(id);
  }
}

export default DeleteTransactionService;
