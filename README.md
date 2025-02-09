# Sincroniza dados sobre luz e energia com CAERN e COSERN(atual neoenergia)
Para facilitar o gerenciamento de casas de aluguel com inquilinos que se negam a ter agua e luz em seu nome, esse software, trás uma interface web com geolocalização e cache offline para consultas rápidas em segundos que podem levar varios minutos e verificando residencia a residencia em sites oficiais da CAERN e COSERN.

## Roadmap
- [x] Sincronizar faturas
- [ ] Login automático
- [ ] Interface WEB

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