/* eslint-disable no-useless-return */
import { getCustomRepository, getRepository, In } from 'typeorm';
import fs from 'fs';
import csvParser from 'csv-parse';

import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TransactionRepository from '../repositories/TransactionsRepository';

interface RequestDTO {
  filePath: string;
}

interface CSVTransactionDTO {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class ImportTransactionsService {
  async execute({ filePath }: RequestDTO): Promise<Transaction[]> {
    // Preparar o arquivo para ser lido
    const contactsReadStream = fs.createReadStream(filePath);

    // Configuracoes de como o parser vai fazer
    const parser = csvParser({
      delimiter: ',',
      from_line: 2,
    });

    // O pipe significa que ele vai lendo a linha conforme ela vai ficando disponivel
    const parseCSV = contactsReadStream.pipe(parser);

    const transactions: CSVTransactionDTO[] = [];
    const categories: string[] = [];

    // ler cada linha do arquivo
    parseCSV.on('data', async line => {
      // Vc ja pode separar direto porque la em cima no parser ele ja havia quebrado a line em cada virgula (,) que encontrasse
      const [title, type, value, category] = line.map((cell: string) =>
        cell.trim(),
      );

      if (!title || !type || !value || !category) return;

      categories.push(category);
      transactions.push({ title, type, value: Number(value), category });
    });

    // Tem que esperar ele terminar pois por natureza ele nao eh async, entao se vc nao esperar vc nao vai ter acesso as variaveis abaixo
    await new Promise(resolve => parseCSV.on('end', resolve));

    // Pegar os repositorios
    const categoriesRespository = getRepository(Category);
    const transactionsRepository = getCustomRepository(TransactionRepository);

    // Pegar todas as categorias existentes
    const existentCategories = await categoriesRespository.find({
      where: {
        // Esse categories eh aquela variavel que vc populou la em cima no parseCVS.on()
        title: In(categories),
      },
    });

    // Colocar as categorias existentes em um array de title
    const existenteCategoriesTitle = existentCategories.map(
      category => category.title,
    );

    // Filtrar para deixar apenas as categorias que nao tem no banco
    const addCategoryTitles = categories
      .filter(category => !existenteCategoriesTitle.includes(category))
      // Segundo filter serve para tirar todas as duplicadas
      .filter((value, index, self) => self.indexOf(value) === index);

    // Criar as instancias das nao existentes tudo de uma vez
    const newCategoriesArray = categoriesRespository.create(
      addCategoryTitles.map(title => ({ title })),
    );
    // Salvar no banco todas elas de uma vez
    await categoriesRespository.save(newCategoriesArray);

    // Total de categorias = as que ja existiam no banco e as que acabaram de ser criadas
    const finalCategories = [...newCategoriesArray, ...existentCategories];

    // Criar todas as transacoes de uma vez... no campo category ele ja ta buscando a instancia do titlo que ja foi criado no bd em cima
    const createdTransactionsArray = transactionsRepository.create(
      transactions.map(transaction => ({
        title: transaction.title,
        type: transaction.type,
        value: transaction.value,
        category: finalCategories.find(
          category => category.title === transaction.category,
        ),
      })),
    );

    // Salva todas as instancias de uma vez
    await transactionsRepository.save(createdTransactionsArray);

    // Deleta o arquivo
    await fs.promises.unlink(filePath);

    // Retorna os dados
    return createdTransactionsArray;
  }
}

export default ImportTransactionsService;
