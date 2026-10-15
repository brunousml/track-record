# Site da trajetória (linha do tempo)

HTML/CSS/JS puro, sem dependências. Conteúdo em `content/items/*.json` (um arquivo por item, PT e EN).

```bash
python3 build.py                 # gera data.js a partir de content/ (rode após editar o conteúdo)
python3 -m http.server 8765      # ou abra index.html direto no browser
```

- Link direto por item: `/#zig`, `/#ibm`, `/#ai-code-reviewer`. Idioma: botão PT/EN ou `?lang=en`.
- Regra editorial: só número confirmado no currículo ou no Brag Document; números de entrega são do time.
- Sem PII aqui (sem endereço, telefone, e-mail ou pretensão).
- Pendente: imagem `og:image` para o cartão do LinkedIn, domínio, métricas de visita.

## Publicação (GitHub Pages)

Site de projeto servido a partir da branch `main`, pasta raiz: https://brunousml.github.io/track-record/

- Antes de cada push, rode `python3 build.py` e inclua o `data.js` no commit (o site lê só esse arquivo).
- Este repositório é público: não coloque aqui PII (endereço, telefone, e-mail, pretensão) nem contatos de recrutadores.
