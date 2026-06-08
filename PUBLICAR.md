# 🚀 Como publicar (só você faz — precisa da TUA conta)

> Eu deixei tudo pronto: código limpo (sem referência interna), testado (13/13), comentado e commitado
> localmente. O que falta é **logar com a tua identidade** — isso eu não faço por você (é a tua conta/nome).

## Antes (1 minuto)
- [ ] Põe teu **nome** no arquivo `LICENSE` (onde está `<SEU NOME AQUI>`).
- [ ] No `package.json`, adiciona teu nome + URL do repo:
  ```json
  "author": "Seu Nome <seu@email>",
  "repository": { "type": "git", "url": "https://github.com/SEU_USUARIO/agent-injection-firewall" }
  ```

## Publicar no GitHub (3 comandos)
```bash
cd ~/.gaia/renda/firewall-repo
gh auth login                          # loga na TUA conta GitHub (uma vez)
gh repo create agent-injection-firewall --public --source=. --push
```
Pronto — teu repo público no ar. Cola o link no perfil (`PERFIL.md`) e no post (`POST.md`).

## Publicar no npm (opcional, depois)
```bash
npm login                              # tua conta npm (uma vez)
npm publish --access public
```
(O nome `agent-injection-firewall` pode já existir no npm — se der erro, troca pra algo como `@seu-usuario/agent-firewall`.)

## O que já está pronto aqui
- `src/` — firewall (injeção + segredo + senha vazada/óbvia), zero dependência externa
- `test/` — 13 testes verdes (`node --test test/*.test.js`)
- `demo.js` — prova visual (`node demo.js`)
- `README.md` — pitch + tabela OWASP LLM
- commit local já feito (é só dar push)

## Dica de OPSEC (já cuidei)
Removi todas as referências internas (nomes de projeto/IDs). O único "andre123" que sobrou é **exemplo de senha
fraca** na documentação — é proposital, não é dado teu.
