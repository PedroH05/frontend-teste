# Como usar

1. Copie a pasta `valetrade-redesign` inteira (esta pasta) para dentro de `captacao-web/docs/`.
   O caminho final tem que ser: `captacao-web/docs/valetrade-redesign/HANDOFF.md`
2. Abra o Claude Code na raiz do `captacao-web`.
3. Cole o prompt abaixo.

---

## Prompt

```
Vamos implementar o redesign do app de captação.

Material em docs/valetrade-redesign/:
- HANDOFF.md → especificação completa (tokens, componentes shadcn, comportamento). Leia inteiro primeiro.
- telas/*.dc.html → mocks do redesign em HTML com estilos inline. Leia como texto: são referência visual, NÃO código para copiar (não abrem no navegador).
- prints-antes/*.png → prints de como o app está hoje, para você comparar antes/depois.

Regras:
- Use os componentes shadcn/ui e o Tailwind que o projeto já tem. Se faltar algum componente shadcn, instale com o CLI do shadcn.
- Não invente dados nem deixe nada hardcoded: ligue tudo nas APIs/queries que já existem (captacao-api).
- Não mude regra de negócio nem chamadas de API; é só camada visual + o estado derivado do wizard descrito no HANDOFF.
- Antes de implementar qualquer item da seção 6 do HANDOFF, me pergunte.

Ordem, um passo por vez, me mostrando o diff e esperando meu ok entre cada um:
1. Tokens no globals.css + tailwind.config (seção 1) e fonte Geist
2. Layout global com a Sidebar do shadcn (seção 2)
3. Wizard "Editar captação" + Revisão (seções 4 e 5), com o estado derivado do formulário
4. Carteira e Histórico
5. Dashboard, Clientes, Anotações e Config

Comece lendo o HANDOFF.md e a estrutura atual do projeto, e me diga o plano do passo 1 antes de editar.
```
