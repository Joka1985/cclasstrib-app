export type CnaeItem = {
  codigo: string;
  descricao: string;
};

export const CNAES: CnaeItem[] = [
  {
    codigo: "47.11-3-01",
    descricao:
      "Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - hipermercados",
  },
  {
    codigo: "47.11-3-02",
    descricao:
      "Comércio varejista de mercadorias em geral, com predominância de produtos alimentícios - supermercados",
  },
  {
    codigo: "46.39-7-01",
    descricao: "Comércio atacadista de produtos alimentícios em geral",
  },
  {
    codigo: "46.91-5-00",
    descricao: "Comércio atacadista de mercadorias em geral, sem predominância de alimentos ou de insumos agropecuários",
  },
  {
    codigo: "10.99-6-99",
    descricao: "Fabricação de outros produtos alimentícios não especificados anteriormente",
  },
  {
    codigo: "70.20-4-00",
    descricao: "Atividades de consultoria em gestão empresarial, exceto consultoria técnica específica",
  },
  {
    codigo: "69.20-6-01",
    descricao: "Atividades de contabilidade",
  },
  {
    codigo: "62.04-0-00",
    descricao: "Consultoria em tecnologia da informação",
  },
  {
    codigo: "62.01-5-01",
    descricao: "Desenvolvimento de programas de computador sob encomenda",
  },
  {
    codigo: "82.99-7-99",
    descricao: "Outras atividades de serviços prestados principalmente às empresas não especificadas anteriormente",
  },
];