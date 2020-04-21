import { getCustomRepository, getRepository } from 'typeorm';
import TransactionRepository from '../repositories/TransactionsRepository';
import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

interface RequestDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: RequestDTO): Promise<Transaction> {
    if (!(type === 'income' || type === 'outcome')) {
      throw new AppError('Type must be "income" or "outcome" ');
    }

    if (!title || !value || !type || !category) {
      throw new AppError(
        'Missing fields. Title, value, type and category are all needed',
      );
    }

    const transactionRepository = getCustomRepository(TransactionRepository);

    const transactionsBalance = await transactionRepository.getBalance();
    if (
      type === 'outcome' &&
      value + transactionsBalance.outcome > transactionsBalance.income
    ) {
      throw new AppError('Outcome balance must no bet higher then income');
    }

    const categoryRepository = getRepository(Category);

    let categorySavedInDatabase = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!categorySavedInDatabase) {
      const createdCategory = categoryRepository.create({ title: category });
      categorySavedInDatabase = await categoryRepository.save(createdCategory);
    }

    const transaction = transactionRepository.create({
      title,
      value,
      type,
      category: categorySavedInDatabase,
    });
    await transactionRepository.save(transaction);
    return transaction;
  }
}

export default CreateTransactionService;
