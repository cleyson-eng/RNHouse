# Sincroniza contas de luz (cosern/neoenergia) e energia(caern)
Para facilitar o gerenciamento de casas de aluguel com inquilinos que se negam a ter agua e luz em seu nome, esse software, trás uma interface web com geolocalização e cache offline para consultas rápidas, levando segundos, que por sites oficiais podem demorar varios minutos e um trabalhor manual tedioso de explorar páginas individuais para cada residencia.

## Roadmap
- [x] Sincronizar faturas
- [ ] Login automático
- [x] Interface WEB
- [ ] Mapa

## Uso:
- requer deno.ts
- para atualizar: `deno run --allow-all update.ts`, requer login manual, siga as instruções.
- para interface web: `deno run --allow-all main.ts`, localhost:8080.
Por ter uso apenas pessoal o cadastro é feito manualmente no usuario.csv e casas.csv na sua pasta de dados...

## Estruturamento dos dados
Na pasta de dados:

### /caern_data/ ou /cosern_data/ (pasta)
- cache de PDFs de faturas `[ID unidade]_[ID fatura].pdf`.
- planilhas com indixes e dados das faturas `[ID unidade].cvs` (para estrutura olhe lib/db.ts -> const TEMPLATE_FATURA).

### /casas.csv
- contas associada e numero de matricula em cada serviço.
- dados de localização.
- coordenadas area.
(para estrutura olhe lib/db.ts -> const TEMPLATE_CASA)

### /usuario.csv
- dados de usuarios necessarios para cada serviço.
(para estrutura olhe lib/db.ts -> const TEMPLATE_USUARIO)