# SISLAB 2.1.0 — Sistema de Gestão Laboratorial (CETEP/LNAB)

O SISLAB é um sistema web **standalone e offline-first**, projetado para otimizar os processos de um laboratório de análises clínicas. Abrange cadastro de pacientes, requisição de exames, emissão de laudos e histórico completo, tudo funcionando diretamente no navegador sem dependência de serviços externos.

Com suporte opcional a **sincronização automática via API REST**, múltiplos dispositivos podem operar offline de forma independente e sincronizar os dados quando houver conexão com a internet.

---

## Arquitetura

```
sislab/
├── index.html                # Cadastro de exames (módulo principal)
├── laudo_resultados.html     # Emissão de laudos
├── admin.html                # Área administrativa + configuração de sync
├── lista-exames.html         # Editor de lista de exames
├── caso_clinico.html         # Geração de casos clínicos educacionais (standalone)
│
├── script.js                 # Lógica do cadastro de exames
├── laudo_scripts.js          # Lógica da emissão de laudos
├── busca_historico.js        # Busca em tempo real no histórico
├── data_storage.js           # Módulo central: localStorage + funções de sync
├── sync.js                   # Motor de sincronização offline-first
├── exames_ref.js             # Dados de referência dos exames (unidades, VR)
├── sislab_utils.js           # Funções utilitárias compartilhadas
│
├── PROMPT_CASO_CLINICO.md    # Prompt estruturado para geração de casos via IA
├── pacientes_aleatorios.json # Dados fictícios para testes
├── lista-de-exames.txt       # Lista padrão de exames (fallback offline)
│
└── sislab-api/               # Backend Flask para sincronização (opcional)
    ├── app.py
    ├── requirements.txt
    ├── Dockerfile
    ├── docker-compose.yml
    └── .env.example
```

---

## Cenários de uso

### Cenário 1 — Uso 100% offline (padrão)

O sistema funciona completamente sem internet. Nenhuma configuração adicional é necessária.

```
[Navegador] → localStorage (dados locais)
```

- Abra `index.html` diretamente no navegador ou sirva com qualquer servidor estático
- Os dados ficam no localStorage do navegador
- Use **Admin → Exportar Dados (JSON)** periodicamente para backup manual
- Para migrar dados entre computadores, use o par Exportar / Importar

---

### Cenário 2 — Um único dispositivo + backup em nuvem

Ideal para laboratórios com um único computador que querem garantia de backup automático.

```
[Computador] ──sync automático──▶ [Servidor REST]
```

1. Suba o `sislab-api` em qualquer servidor (ver instruções abaixo)
2. Em `admin.html`, configure o endpoint e um intervalo de sync (ex.: 15 min)
3. O sistema sincroniza silenciosamente em background quando houver internet
4. Se a internet cair, continua funcionando offline; sincroniza na próxima janela

---

### Cenário 3 — Múltiplos dispositivos offline

Dois ou mais computadores/tablets usam o sistema de forma independente e sincronizam quando há internet.

```
[Computador A] ──▶┐
                  ├──▶ [Servidor REST] ◀──┬── pull de cada dispositivo
[Tablet B]     ──▶┘
```

- Cada dispositivo opera 100% offline
- O número de protocolo é `NNNN-HHMMDDmm`: mesmo que dois dispositivos gerem `0001`, o sufixo de hora os torna únicos (`0001-1456` ≠ `0001-2055`)
- Conflito de edição resolvido por **timestamp** — o registro mais recente prevalece
- Ao sincronizar, cada dispositivo envia o que criou e recebe o que o outro criou

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
- Indicador ✓/⏳ no histórico mostrando se o laudo já foi emitido para cada protocolo
- Exclusão em lote de protocolos selecionados
- Impressão em lote de protocolos selecionados
- Geração de paciente aleatório para testes

**Armazenamento:** chave `sislab_historico` no localStorage.

---

### Emissão de Laudos (`laudo_resultados.html`)

Interface para preencher resultados de exames e gerar laudos em PDF.

- Busca de protocolo por número, CPF ou nome do paciente
- Carregamento automático dos dados do paciente e da lista de exames do protocolo
- Campos dinâmicos por exame: resultado, unidade, valores de referência (pré-preenchidos), material de coleta, método, observação específica e realizador do exame
- Modo somente leitura por padrão; edição item a item com botão "Editar"
- **Exame avulso:** botão "+ Adicionar Exame Não Listado" insere um item com todos os campos livres (nome, material, método, resultado, unidade, referência, observação); identificado com borda verde; salvo com `custom: true` no laudo e recarregado corretamente na próxima edição
- **Atalho WhatsApp:** ícone verde ao lado do nome do paciente abre link `wa.me` com mensagem formatada (negrito, itálico, emojis, separadores) contendo nome completo, data de coleta, lista de exames como marcadores e aviso educacional em destaque
- Código de verificação único por laudo (formato `XXXX-XXXX-XXXX-XXXX`) exibido na tela e no rodapé do PDF
- Faixa discreta de aviso educacional na margem esquerda de todas as páginas do PDF
- Observações gerais do laudo
- Responsável técnico (nome e registro CRBM/CRF) persistido entre laudos
- Geração de PDF do laudo com cabeçalho profissional (faixa institucional, logos, RESULTADOS)
- Identificação do paciente (protocolo | nome | idade) em páginas de continuação
- Suporte a múltiplas páginas com cabeçalho e rodapé repetidos

**Armazenamento:** chave `sislab_laudos` no localStorage.

---

### Área Administrativa (`admin.html`)

Ferramentas de gerenciamento protegidas por senha dinâmica.

| Ação | Descrição |
|---|---|
| **Editar Lista de Exames** | Edita a lista de exames no navegador |
| **Limpar TODO o Histórico** | Apaga todos os protocolos do localStorage |
| **Gerar Paciente Aleatório** | Abre o cadastro com dados fictícios preenchidos |
| **Exportar Dados (JSON)** | Baixa backup com histórico + laudos (requer senha) |
| **Importar Dados (JSON)** | Importa JSON ignorando duplicatas por protocolo (requer senha) |
| **Caso Clínico** | Acessa a página de geração de casos clínicos educacionais |
| **Configurar Sincronização** | Define endpoint, intervalo e chave de API para sync automático |

---

### Caso Clínico (`caso_clinico.html`)

Módulo educacional **standalone** — os dados **não** são gravados no histórico convencional do sistema.

**Fluxo:**

1. Copie o prompt de `PROMPT_CASO_CLINICO.md` (ou use o botão na própria página)
2. Cole em Claude, ChatGPT, Gemini ou outra IA e aguarde o JSON
3. Cole o JSON na página ou faça upload do arquivo `.json`
4. Revise os dados (todos os campos editáveis) e preencha o responsável técnico
5. Clique **Gerar Laudo PDF** — o PDF terá o stamp "CASO CLÍNICO: [Título]" em faixa teal em todas as páginas

**Características:**
- Prompt inclui 20 endereços reais de Alagoinhas-BA, listas de nomes e sobrenomes brasileiros
- A IA retorna resultados, referências, importância clínica e método já preenchidos — pronto para impressão
- Aceita JSON colado diretamente na textarea ou via arquivo `.json`
- Remove automaticamente blocos de código markdown (` ```json ``` `) gerados por algumas IAs
- Código de verificação e aviso educacional presentes no PDF
- Nenhuma escrita em `sislab_historico` ou `sislab_laudos`

---

## Armazenamento de Dados (localStorage)

| Chave | Conteúdo |
|---|---|
| `sislab_historico` | Array de protocolos de atendimento |
| `sislab_laudos` | Array de laudos emitidos |
| `sislab_lista_exames` | Cache da lista de exames |
| `sislab_sync_config` | Configuração de sincronização (endpoint, intervalo, chave) |
| `sislab_last_sync` | Timestamp ISO da última sincronização bem-sucedida |

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
  "timestamp": 1748952600000,
  "synced": true
}
```

> O campo `synced` indica se o registro já foi enviado ao servidor. Registros criados offline nascem com `synced: false` e são marcados `true` após o próximo ciclo de sincronização.

---

## Import / Export JSON (backup manual)

### Exportar
**Admin → Exportar Dados (JSON)** — baixa `sislab_backup_YYYY-MM-DD.json`:

```json
{
  "version": "2.1",
  "exportDate": "2026-06-03T...",
  "historico": [ ... ],
  "laudos": [ ... ]
}
```

### Importar
**Admin → Importar Dados (JSON)** — seleciona o arquivo JSON.

Regra de deduplicação: registros cujo `protocolo` já existe são **ignorados automaticamente**. Apenas registros novos são adicionados. Ao final, o sistema exibe quantos foram adicionados e quantos ignorados.

---

## Sincronização via API REST (`sync.js`)

O módulo `sync.js` implementa sincronização automática em background **e sincronização imediata a cada save**, ativada somente quando um endpoint estiver configurado.

### Sincronização imediata (fire-and-forget)

A partir da v2.2, cada salvar de protocolo (`script.js`) e de laudo (`laudo_scripts.js`) dispara `sincronizarAgora()` automaticamente logo após gravar no localStorage. Se a tentativa falhar (offline, chave errada), o registro permanece com `synced: false` e o timer de background faz o retry.

Um toast discreto informa o resultado:
| Situação | Toast |
|---|---|
| Sucesso | 🟢 "Protocolo/Laudo enviado ao servidor." |
| Offline | 🔵 "Offline — será sincronizado pelo temporizador." |
| Erro de API | 🔴 "Erro de sincronização: HTTP 401" |
| Sem endpoint | *(silencioso)* |

### Como configurar

1. Acesse **Admin → Configurar Sincronização**
2. Informe o **Endpoint da API** (ex.: `https://meu-servidor.com/api/sislab`)
3. Escolha o **intervalo** (5, 15, 30 ou 60 minutos)
4. Informe a **Chave de API** (se configurada no servidor)
5. Clique em **Salvar Configuração**

A barra de status exibe: `🟢 Online | Última sinc: 14:32 | Pendentes: 3 registros`

### Ciclo de sincronização

```
1. Verifica navigator.onLine → aborta silenciosamente se offline
2. Envia registros com synced:false ao servidor (POST /push)
3. Marca esses registros como synced:true localmente
4. Busca registros novos do servidor (GET /pull?since=TIMESTAMP)
5. Faz merge local: timestamp mais recente prevalece em caso de conflito
6. Atualiza lastSyncAt
```

### Resolução de conflitos

| Situação | Resultado |
|---|---|
| Registro existe apenas localmente | Enviado ao servidor no próximo push |
| Registro existe apenas no servidor | Baixado e adicionado localmente |
| Mesmo protocolo modificado em dois lugares | Versão com `timestamp` mais recente prevalece |
| Internet indisponível | Sync pulado; dados locais intactos |

---

## Backend de Sincronização (`sislab-api/`)

API Flask mínima para persistir e distribuir registros entre dispositivos.

### Endpoints

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/api/sislab/push` | Recebe `{ historico, laudos }` e persiste no banco |
| `GET` | `/api/sislab/pull?since=ISO` | Devolve registros mais recentes que `since` |
| `GET` | `/api/sislab/status` | Healthcheck com contagem de registros |

Autenticação opcional via header `X-API-Key`.  
Banco padrão: **SQLite** (arquivo local). Suporta PostgreSQL via variável `DATABASE_URL`.

### Instalação sem Docker (Oracle Cloud VM ~100 MB RAM livre)

```bash
# 1. Criar swap de 512 MB (uma vez — evita OOM em picos de carga)
sudo fallocate -l 512M /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# 2. Instalar dependências
cd sislab-api
pip install -r requirements.txt

# 3. Configurar variáveis de ambiente
cp .env.example .env
nano .env  # ajustar SISLAB_API_KEY

# 4. Iniciar com gunicorn (1 worker — adequado para ~100 MB RAM)
gunicorn app:app --workers 1 --threads 2 --preload --bind 0.0.0.0:5000
```

### Instalação com Docker

```bash
cd sislab-api
cp .env.example .env   # ajustar SISLAB_API_KEY
docker compose up -d
```

### Variáveis de ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `DATABASE_URL` | `sqlite:///sislab.db` | URL do banco (SQLite ou PostgreSQL) |
| `SISLAB_API_KEY` | *(vazio)* | Chave de API — vazio desativa autenticação |

---

## Módulos JavaScript

| Arquivo | Versão | Responsabilidade |
|---|---|---|
| `data_storage.js` | 2.1 | localStorage: CRUD, import/export, funções de sync |
| `sync.js` | 1.0 | Motor de sync: push, pull, merge, timer automático |
| `script.js` | 2.1.0 | Lógica do cadastro de exames (`index.html`) |
| `laudo_scripts.js` | 1.0.40 | Lógica da emissão de laudos (`laudo_resultados.html`) |
| `busca_historico.js` | — | Busca em tempo real no histórico |
| `exames_ref.js` | 1.0.0 | Dados de referência: unidades, valores de referência, métodos |
| `sislab_utils.js` | 1.1.0 | Funções utilitárias: formatação de datas, showError/clearError |

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| HTML5 / CSS3 / JavaScript ES6+ | Interface e lógica |
| `localStorage` | Persistência offline |
| ES Modules (`import`/`export`) | Organização modular |
| [jsPDF](https://github.com/parallax/jsPDF) | Geração de PDFs no navegador |
| Flask + SQLAlchemy | Backend de sincronização (opcional) |
| SQLite / PostgreSQL | Banco do backend |

Sem dependências de NPM, sem build step no frontend. Basta servir com qualquer servidor estático.

```bash
python -m http.server 8080
# Acesse http://localhost:8080
```

---

## Senha de Acesso Administrativo

A senha é dinâmica: `sislab` + hora atual (HH) + minuto atual (mm).  
Exemplo: às 14h37, a senha é `sislab1437`.

> A senha é calculada no momento em que o prompt é exibido. Se o minuto mudar enquanto o usuário digita, a senha digitada ainda é aceita (o valor é capturado antes do prompt abrir).

---

## Formato do Número de Protocolo

Formato: `NNNN-HHMMDDmm`

| Parte | Significado | Exemplo |
|---|---|---|
| `NNNN` | Contador sequencial local (4 dígitos) | `0001` |
| `HH` | Hora do cadastro | `15` |
| `MM` | Minuto do cadastro | `30` |
| `DD` | Dia | `17` |
| `mm` | Mês | `06` |

**Exemplo:** `0001-15301706` → 1º protocolo, gerado às 15h30 do dia 17/06.

Em ambientes com múltiplos dispositivos offline, dois dispositivos podem gerar sequências independentes (`0001`, `0001`...), mas o sufixo de hora os torna únicos globalmente — `0001-1456` e `0001-2055` nunca colidem.
