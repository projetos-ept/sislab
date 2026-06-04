"""
sislab-api — Backend mínimo de sincronização para o SISLAB
Endpoints:
  POST /api/sislab/push  — recebe registros do cliente
  GET  /api/sislab/pull  — devolve registros novos desde ?since=ISO_TIMESTAMP
"""

import os
import json
from datetime import datetime, timezone
from flask import Flask, request, jsonify, abort
from flask_cors import CORS
from sqlalchemy import create_engine, Column, String, Text, Float, Boolean
from sqlalchemy.orm import DeclarativeBase, Session

app = Flask(__name__)
CORS(app)

DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///sislab.db')
API_KEY      = os.getenv('SISLAB_API_KEY', '')   # vazio = sem autenticação

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False}
                       if DATABASE_URL.startswith('sqlite') else {})


class Base(DeclarativeBase):
    pass


class Protocolo(Base):
    __tablename__ = 'historico'
    protocolo  = Column(String, primary_key=True)
    id         = Column(String, nullable=False)
    dados_json = Column(Text,   nullable=False)   # registro completo em JSON
    timestamp  = Column(Float,  default=0.0)
    synced     = Column(Boolean, default=True)


class Laudo(Base):
    __tablename__ = 'laudos'
    protocolo    = Column(String, primary_key=True)
    id           = Column(String, nullable=False)
    dados_json   = Column(Text,  nullable=False)
    data_emissao = Column(String, default='')
    synced       = Column(Boolean, default=True)


class ExamList(Base):
    __tablename__ = 'exam_list'
    id      = Column(String, primary_key=True, default='singleton')
    conteudo = Column(Text, default='')   # newline-separated, sorted


Base.metadata.create_all(engine)


# ── Helpers de lista de exames ────────────────────────────────────────────

def get_exam_list(session) -> str:
    row = session.get(ExamList, 'singleton')
    return row.conteudo if row else ''


def merge_exam_list(session, incoming: str):
    current = get_exam_list(session)
    local_lines  = [l.strip() for l in current.split('\n')  if l.strip()]
    remote_lines = [l.strip() for l in incoming.split('\n') if l.strip()]
    merged = sorted(set(local_lines) | set(remote_lines), key=lambda x: x.lower())
    merged_text = '\n'.join(merged)
    row = session.get(ExamList, 'singleton')
    if row is None:
        session.add(ExamList(id='singleton', conteudo=merged_text))
    else:
        row.conteudo = merged_text


# ── Autenticação ──────────────────────────────────────────────────────────

def verificar_auth():
    if not API_KEY:
        return
    chave = request.headers.get('X-API-Key', '')
    if chave != API_KEY:
        abort(401, 'Chave de API inválida.')


# ── Helpers ───────────────────────────────────────────────────────────────

def row_to_dict(dados_json: str) -> dict:
    try:
        return json.loads(dados_json)
    except Exception:
        return {}


# ── Endpoints ─────────────────────────────────────────────────────────────

@app.post('/api/sislab/push')
def push():
    verificar_auth()
    body = request.get_json(force=True, silent=True) or {}
    historico = body.get('historico', [])
    laudos    = body.get('laudos', [])
    processados = 0

    lista_exames = body.get('listaExames', '')

    with Session(engine) as session:
        for entry in historico:
            prot = entry.get('protocolo')
            if not prot:
                continue
            existing = session.get(Protocolo, prot)
            if existing is None:
                session.add(Protocolo(
                    protocolo  = prot,
                    id         = entry.get('id', ''),
                    dados_json = json.dumps(entry, ensure_ascii=False),
                    timestamp  = entry.get('timestamp', 0),
                    synced     = True
                ))
                processados += 1
            else:
                # atualiza se o registro recebido é mais recente
                if entry.get('timestamp', 0) > (existing.timestamp or 0):
                    existing.dados_json = json.dumps(entry, ensure_ascii=False)
                    existing.timestamp  = entry.get('timestamp', 0)

        for laudo in laudos:
            prot = laudo.get('protocolo')
            if not prot:
                continue
            existing = session.get(Laudo, prot)
            ts_remote = laudo.get('dataEmissao', '')
            if existing is None:
                session.add(Laudo(
                    protocolo    = prot,
                    id           = laudo.get('id', ''),
                    dados_json   = json.dumps(laudo, ensure_ascii=False),
                    data_emissao = ts_remote,
                    synced       = True
                ))
                processados += 1
            else:
                if ts_remote > (existing.data_emissao or ''):
                    existing.dados_json   = json.dumps(laudo, ensure_ascii=False)
                    existing.data_emissao = ts_remote

        if lista_exames:
            merge_exam_list(session, lista_exames)

        session.commit()

    return jsonify({'ok': True, 'processados': processados})


@app.get('/api/sislab/pull')
def pull():
    verificar_auth()
    since_str = request.args.get('since', '1970-01-01T00:00:00.000Z')

    # Converte ISO string para timestamp Unix (ms) para comparar com Protocolo.timestamp
    try:
        since_dt  = datetime.fromisoformat(since_str.replace('Z', '+00:00'))
        since_ms  = since_dt.timestamp() * 1000
    except ValueError:
        since_ms  = 0
        since_str = '1970-01-01T00:00:00.000Z'

    with Session(engine) as session:
        historico = [
            row_to_dict(r.dados_json)
            for r in session.query(Protocolo).filter(Protocolo.timestamp > since_ms).all()
        ]
        laudos = [
            row_to_dict(r.dados_json)
            for r in session.query(Laudo).filter(Laudo.data_emissao > since_str).all()
        ]
        lista_exames = get_exam_list(session)

    return jsonify({'historico': historico, 'laudos': laudos, 'listaExames': lista_exames})


@app.get('/api/sislab/status')
def status():
    verificar_auth()
    with Session(engine) as session:
        n_hist   = session.query(Protocolo).count()
        n_laudos = session.query(Laudo).count()
    return jsonify({
        'ok': True,
        'historico': n_hist,
        'laudos': n_laudos,
        'server_time': datetime.now(timezone.utc).isoformat()
    })


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
