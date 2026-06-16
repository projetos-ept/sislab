# CLAUDE.md — Instruções para o Claude Code (SISLAB)

## Fluxo de trabalho obrigatório

Após cada ciclo de alterações (push concluído), **sempre abrir um Pull Request** automaticamente
do branch de trabalho para `main`, sem necessidade de o usuário pedir.

O PR deve conter:
- Título conciso (≤ 70 chars) descrevendo o conjunto de mudanças
- Body com seções **Summary** (bullet points) e **Test plan** (checklist)

## Convenções do projeto

- Branch padrão de destino: `main`
- Mensagens de commit em português ou inglês técnico
- Não quebrar implementações de sync (`sync.js`, `data_storage.js`) ao editar outros módulos
- Geração de PDF usa jsPDF 2.5.1 (UMD) — testar coordenadas mm, não px
- Toda lógica de cabeçalho do laudo vive em `renderLaudoHeader()` em `laudo_scripts.js`
