# Prompt para Geração de Caso Clínico com IA

Copie o texto abaixo e cole em **Claude, ChatGPT, Gemini** ou qualquer outra IA generativa.
O retorno será um JSON pronto para importar na página `caso_clinico.html` do SISLAB.

> **Dica:** peça à IA para variar o tema — ex.: "gere um caso de insuficiência renal crônica"
> ou "gere um caso pediátrico de anemia" — e ela adaptará os exames e resultados automaticamente.

---

## Prompt

```
Você é um auxiliar de geração de casos clínicos educacionais para um sistema laboratorial brasileiro.
Gere um caso clínico fictício e retorne APENAS o JSON válido abaixo, sem texto adicional.

REGRAS OBRIGATÓRIAS:
• Escolha nome e sobrenome aleatórios das listas abaixo
• Idade entre 8 e 72 anos; calcule dataNasc retroativamente a partir de hoje
• Escolha um endereço aleatório da lista de Alagoinhas-BA
• Inclua de 3 a 6 exames laboratoriais coerentes com o quadro clínico
• Preencha resultado, unidade e referencia para TODOS os exames
• observacaoExame: importância clínica do exame e interpretação do resultado obtido (2-4 linhas)
• metodo: técnica laboratorial real usada para aquele exame (ex.: Quimioluminescência, HPLC, PCR)
• material: amostra biológica (ex.: Soro, Sangue Total, Urina, Plasma)
• observacoesGerais: interpretação clínica integrativa do caso (4-6 linhas)
• Gere ids de 14 chars alfanuméricos minúsculos; protocolo no formato "CASO-NNN"
• O campo titulo define o tema (ex.: "Anemia Ferropriva em Adolescente")

NOMES MASCULINOS: Anderson, Bruno, Carlos, Diego, Eduardo, Felipe, Gabriel, Henrique,
Igor, João, Lucas, Marcos, Nicolas, Pedro, Rafael, Samuel, Thiago, Vinícius, Wanderson

NOMES FEMININOS: Ana Clara, Beatriz, Camila, Daniela, Eduarda, Fernanda, Gabriela,
Helena, Isabela, Juliana, Larissa, Mariana, Natália, Patrícia, Renata, Silvana, Tatiane

SOBRENOMES: Silva, Santos, Oliveira, Costa, Ferreira, Almeida, Lima, Carvalho, Souza,
Rocha, Nascimento, Batista, Peixoto, Mendes, Araújo, Barbosa, Pinheiro, Lopes, Ramos

ENDEREÇOS — ALAGOINHAS/BA:
1. Rua Cel. João Dias, 45, Centro, Alagoinhas - BA
2. Av. Irmã Alice, 112, Aviário, Alagoinhas - BA
3. Rua do Progresso, 78, Urbis IV, Alagoinhas - BA
4. Rua Padre Cícero, 230, Jorge Amado, Alagoinhas - BA
5. Rua 7 de Setembro, 98, Centro, Alagoinhas - BA
6. Rua João Pessoa, 15, Rui Barbosa, Alagoinhas - BA
7. Rua Benjamin Constant, 321, São Pedro, Alagoinhas - BA
8. Rua Euclides da Cunha, 55, Centro, Alagoinhas - BA
9. Rua Sete Quedas, 402, Urbis II, Alagoinhas - BA
10. Rua Antônio Balbino, 37, Brasília, Alagoinhas - BA
11. Rua Luís Eduardo Magalhães, 88, São Caetano, Alagoinhas - BA
12. Rua Cel. Nilton Carneiro, 194, Taquaral, Alagoinhas - BA
13. Av. Presidente Vargas, 516, Alto da Boa Vista, Alagoinhas - BA
14. Rua da Saudade, 29, Monte Sinai, Alagoinhas - BA
15. Rua do Catu, 143, Catu de Alagoinhas - BA
16. Rua São Benedito, 77, Nova América, Alagoinhas - BA
17. Rua do Sol, 210, Teresópolis, Alagoinhas - BA
18. Rua 25 de Dezembro, 63, Centro, Alagoinhas - BA
19. Rua Piauí, 118, Jardim Centenário, Alagoinhas - BA
20. Rua Dr. Geraldo Magalhães, 350, Alto do Forno, Alagoinhas - BA

FORMATO JSON EXATO (retorne apenas isso, sem markdown, sem blocos de código):
{
  "titulo": "string — tema do caso clínico",
  "version": "2.1",
  "historico": [{
    "id": "string 14 chars alfanuméricos minúsculos",
    "protocolo": "CASO-001",
    "nome": "string",
    "cpf": "string 11 dígitos fictícios",
    "dataNasc": "YYYY-MM-DD",
    "idade": "X anos e Y meses",
    "sexo": "Masculino ou Feminino",
    "endereco": "string (use endereço da lista acima)",
    "contato": "(75) 9XXXX-XXXX",
    "observacoes": "string — história clínica: sintomas, tempo de evolução, contexto",
    "exames": ["Nome Exame 1", "Nome Exame 2"],
    "examesNaoListados": "",
    "timestamp": 0,
    "synced": false
  }],
  "laudos": [{
    "id": "string 14 chars alfanuméricos minúsculos diferente do anterior",
    "patientId": "<id do historico acima>",
    "protocolo": "CASO-001",
    "nomePaciente": "<mesmo nome do historico>",
    "cpfPaciente": "<mesmo cpf do historico>",
    "examesResultados": [
      {
        "nomeExame": "string — nome completo do exame",
        "resultado": "string — valor numérico ou textual do resultado",
        "unidade": "string — ex.: mg/dL, %, U/L",
        "referencia": "string — faixa de referência completa com unidade",
        "observacaoExame": "string — importância clínica e interpretação deste resultado específico",
        "material": "string — ex.: Soro, Sangue Total, Urina, Plasma",
        "metodo": "string — técnica laboratorial real",
        "realizadoPor": ""
      }
    ],
    "observacoesGerais": "string — interpretação clínica integrativa de todos os resultados",
    "responsavelTecnico": { "nome": "", "registro": "" },
    "synced": false
  }]
}
```

---

## Fluxo de uso

1. Copie o prompt acima
2. Cole em Claude, ChatGPT, Gemini ou outra IA
3. Opcionalmente acrescente ao final: *"O caso deve ser sobre [tema]"*
4. Copie o JSON retornado
5. Acesse `caso_clinico.html` → cole na caixa de texto → clique **Carregar JSON colado**
6. Revise os dados e clique **Gerar Laudo PDF**

> O sistema remove automaticamente blocos de código markdown (` ```json ``` `)
> que algumas IAs incluem na resposta.

---

## Exemplo de tema sugerido por contexto clínico

| Tema sugerido | Exames esperados |
|---|---|
| Anemia ferropriva em adolescente | Hemograma, Ferritina, Ferro sérico, Transferrina |
| Diabetes tipo 2 descompensado | Glicemia de Jejum, HbA1c, Triglicerídeos, Colesterol |
| Hipotireoidismo em adulto | TSH, T4 Livre, Anti-TPO |
| Insuficiência renal crônica | Creatinina, Ureia, Potássio, Sódio, Hemograma |
| Hepatite viral aguda | TGO, TGP, Bilirrubinas, GamaGT, HBsAg, Anti-HCV |
| Síndrome nefrótica em criança | Proteínas totais, Albumina, Colesterol, Microalbuminúria |
| Lúpus eritematoso sistêmico | FAN, Anti-DNA, Hemograma, Creatinina, Complemento C3/C4 |
| Monitoramento de lítio (bipolaridade) | Lítio, TSH, Creatinina, Hemograma |
