# SISLAB 2.1.0 — Sistema de Gestão Laboratorial (CETEP/LNAB)

O SISLAB é um sistema web **standalone e offline**, projetado para otimizar os processos de um laboratório de análises clínicas. Abrange cadastro de pacientes, requisição de exames, emissão de laudos e histórico completo, tudo funcionando diretamente no navegador sem dependência de serviços externos.

---

## Arquitetura

O sistema é **100% frontend** (HTML + JavaScript puro), sem backend ou serviços em nuvem. Todos os dados são persistidos localmente via `localStorage` do navegador, com suporte a import/export em JSON para backup e migração.

```
sislab/
├── index.html              # Cadastro de exames (módulo principal)
├── laudo_resultados.html   # Emissão de laudos
├── admin.html              # Área administrativa
├── lista-exames.html       # Editor de lista de exames
├── script.js               # Lógica do cadastro de exames
├── laudo_scripts.js        # Lógica da emissão de laudos
├── busca_historico.js      # Busca em tempo real no histórico
├── data_storage.js         # Módulo central de armazenamento (localStorage)
├── exames_ref.js           # Dados de referência dos exames (unidades, VR)
├── sislab_utils.js         # Funções utilitárias compartilhadas
├── pacientes_aleatorios.json  # Dados fictícios para testes
└── lista-de-exames.txt     # Lista padrão de exames (fallback offline)
```

---

## Módulos

### Cadastro de Exames (`index.html`)

Interface principal para atendimento ao paciente.

- Registro completo: nome, CPF, data de nascimento, sexo, contato, endereço, observações
- Validação de CPF (algoritmo) e DDD (lista de DDDs válidos brasileiros)
- Opção "Ignorar CPF" para casos sem CPF disponível
- Cálculo automático de idade a partir da data de nascimento
- Verificação de CPF no histórico com opção de carregar dados do paciente recorrente
- Seleção de exames por pesquisa (lista carregada do cache ou `lista-de-exames.txt`)
- Campo para exames não listados (texto livre)
- Geração de Protocolo de Atendimento em PDF (via jsPDF)
- Histórico de cadastros com busca em tempo real (protocolo, CPF ou nome)
- Exclusão em lote de protocolos selecionados
- Impressão em lote de protocolos selecionados
- Geração de paciente aleatório para testes (`pacientes_aleatorios.json`)

**Armazenamento:** chave `sislab_historico` no localStorage.

---

### Emissão de Laudos (`laudo_resultados.html`)

Interface para preencher resultados de exames e gerar laudos em PDF.

- Busca de protocolo por número, CPF ou nome do paciente
- Carregamento automático dos dados do paciente e da lista de exames do protocolo
- Campos dinâmicos por exame: resultado, unidade, valores de referência (pré-preenchidos via `exames_ref.js`), material de coleta, método e observação específica
- Modo somente leitura por padrão; edição item a item com botão "Editar"
- Observações gerais do laudo
- Responsável técnico (nome e registro CRBM/CRF) persistido entre laudos
- Geração de PDF do laudo com logo, dados do paciente, exames e assinatura
- Suporte a múltiplas páginas com cabeçalho e rodapé repetidos
- Salvamento do laudo (substituindo versão anterior do mesmo protocolo)

**Armazenamento:** chave `sislab_laudos` no localStorage.

---

### Área Administrativa (`admin.html`)

Ferramentas de gerenciamento protegidas por senha dinâmica (`sislab` + `HH` + `mm`).

| Ação | Descrição |
|---|---|
| **Editar Lista de Exames** | Edita a lista de exames no navegador (salva em `sislab_lista_exames`) |
| **Limpar TODO o Histórico** | Apaga todos os protocolos do localStorage |
| **Gerar Paciente Aleatório** | Abre o cadastro com dados fictícios preenchidos |
| **Exportar Dados (JSON)** | Baixa backup com histórico + laudos |
| **Importar Dados (JSON)** | Importa JSON ignorando duplicatas por protocolo |

---

## Armazenamento de Dados (localStorage)

| Chave | Conteúdo |
|---|---|
| `sislab_historico` | Array de protocolos de atendimento |
| `sislab_laudos` | Array de laudos emitidos |
| `sislab_lista_exames` | Cache da lista de exames (sobrescreve o arquivo local) |

### Estrutura de um protocolo (`sislab_historico`)

```json
{
  "id": "abc123",
  "protocolo": "0001-15301706",
  "nome": "Nome do Paciente",
  "cpf": "12345678900",
  "dataNasc": "1990-06-15",
  "idade": "35 anos e 11 meses",
  "sexo": "Feminino",
  "endereco": "Rua Exemplo, 123",
  "contato": "(71) 99999-0000",
  "observacoes": "",
  "exames": ["Hemograma Completo", "Glicemia de Jejum"],
  "examesNaoListados": "",
  "timestamp": 1748952600000
}
```

---

## Import / Export JSON

### Exportar
**Admin → Exportar Dados (JSON)** — baixa `sislab_backup_YYYY-MM-DD.json`:

```json
{
  "version": "2.0",
  "exportDate": "2026-06-03T...",
  "historico": [ ... ],
  "laudos": [ ... ]
}
```

### Importar
**Admin → Importar Dados (JSON)** — seleciona o arquivo JSON.

Regra de deduplicação: registros cujo `protocolo` já existe no localStorage são **ignorados automaticamente**. Apenas registros novos são adicionados. Ao final, o sistema exibe quantos foram adicionados e quantos ignorados.

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 / JavaScript ES6+ | Interface e lógica |
| `localStorage` | Persistência de dados (offline) |
| [jsPDF](https://github.com/parallax/jsPDF) | Geração de PDFs no navegador |
| ES Modules (`import`/`export`) | Organização modular do código |

Sem dependências de NPM, sem build step. Basta abrir os arquivos HTML no navegador ou servir com qualquer servidor estático (ex.: `python -m http.server`).

---

## Módulos JavaScript

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `data_storage.js` | 2.0 | Módulo central: leitura/escrita no localStorage, import/export JSON |
| `script.js` | 2.1.0 | Lógica do cadastro de exames (index.html) |
| `laudo_scripts.js` | 1.0.40 | Lógica da emissão de laudos (laudo_resultados.html) |
| `busca_historico.js` | — | Busca em tempo real no histórico (index.html) |
| `exames_ref.js` | 1.0.0 | Dados de referência: unidades, valores de referência, métodos por exame |
| `sislab_utils.js` | 1.1.0 | Funções utilitárias: formatação de datas, showError/clearError |

---

## Como usar offline

1. Clone ou baixe o repositório
2. Abra `index.html` diretamente no navegador **ou** sirva localmente:
   ```bash
   python -m http.server 8080
   # Acesse http://localhost:8080
   ```
3. A lista de exames é carregada de `lista-de-exames.txt` na primeira vez e cacheada no localStorage
4. Todos os dados ficam no navegador; use **Exportar Dados** periodicamente para backup

> **Nota:** A geração de PDFs usa a CDN do jsPDF (`cdnjs.cloudflare.com`). Para uso completamente offline, baixe o arquivo `jspdf.umd.min.js` e ajuste o `src` nos HTMLs.

---

## Senha de Acesso Administrativo

A senha é dinâmica: `sislab` + hora atual (HH) + minuto atual (mm).  
Exemplo: às 14h37, a senha é `sislab1437`.
