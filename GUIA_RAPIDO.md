# Guia Rápido de Uso - Magic: The Gathering Search

## Como Iniciar o Aplicativo

### Modo Desenvolvimento Web (Recomendado para testes):
```bash
# Usando o script criado
./dev-web.sh

# OU manualmente
npx vite --config vite.config.web.ts
```

### Modo Desenvolvimento Electron:
```bash
npm run dev
```

## Funcionalidades Principais

### 1. Buscar Cartas 🔍

1. Digite o nome da carta no campo de busca
2. Clique em "Buscar" ou pressione Enter
3. As cartas aparecerão no grid abaixo

**Exemplo de buscas:**
- `lightning bolt` - busca por nome
- `dragon` - busca todas as cartas com "dragon" no nome
- `t:creature` - busca todas as criaturas
- `c:red` - busca todas as cartas vermelhas

### 2. Usar Filtros Avançados 🎯

1. Clique em "Filtros Avançados +" para expandir o painel
2. Selecione as cores desejadas (pode selecionar múltiplas)
3. Selecione os tipos de carta (pode selecionar múltiplos)
4. Escolha a raridade no dropdown
5. Digite o CMC (Custo de Mana Convertido) se desejar
6. Os filtros são aplicados automaticamente ao buscar
7. Use "Limpar Filtros" para resetar tudo

**Exemplo:**
- Cores: Vermelho + Verde
- Tipos: Creature
- Raridade: Rara
- CMC: 4
- Resultado: Criaturas raras vermelhas/verdes com CMC 4

### 3. Controlar Tamanho das Cartas 📏

Use os botões abaixo do campo de busca:
- **Pequeno**: Mostra mais cartas na tela
- **Médio**: Tamanho padrão (recomendado)
- **Grande**: Cartas maiores para ver detalhes

### 4. Adicionar Cartas ao Deck ➕

1. Busque as cartas desejadas
2. Clique no botão "+ Deck" abaixo de cada carta
3. Um contador aparecerá na aba "Meus Decks" mostrando quantas cartas você adicionou
4. Você pode adicionar a mesma carta múltiplas vezes

### 5. Gerenciar Decks 📚

#### Visualizar Deck Atual:
1. Clique na aba "Meus Decks"
2. O painel "Deck Atual" mostra todas as cartas adicionadas
3. Use o botão "Remover" para tirar cartas do deck

#### Salvar um Deck:
1. Adicione cartas ao deck atual
2. Clique em "Salvar Deck Atual (X cartas)"
3. Digite um nome para o deck
4. Clique em "Salvar"
5. O deck aparecerá na lista "Decks Salvos"

#### Carregar um Deck Salvo:
1. Na lista "Decks Salvos", clique no deck desejado
2. As cartas do deck aparecerão no painel "Deck Atual"

#### Excluir um Deck:
1. Clique no botão "×" ao lado do nome do deck
2. O deck será removido permanentemente

#### Limpar Deck Atual:
1. Clique em "Limpar Deck Atual"
2. Todas as cartas serão removidas (mas os decks salvos permanecem)

### 6. Exportar Decks 💾

#### Exportar um Deck Individual:
1. Na lista "Decks Salvos", clique no botão "↓" ao lado do deck
2. Um arquivo JSON será baixado automaticamente
3. Nome do arquivo: `nome-do-deck.json`

#### Exportar Todos os Decks:
1. Clique no botão "Exportar Todos os Decks"
2. Um arquivo JSON com todos os decks será baixado
3. Nome do arquivo: `all-decks-[timestamp].json`

### 7. Importar Decks 📥

1. Clique no botão "Importar Deck"
2. Selecione um arquivo JSON válido
3. O deck será adicionado à lista de decks salvos
4. Uma mensagem de sucesso aparecerá

**Formato aceito:**
- Arquivos `.json` exportados pelo próprio aplicativo
- Formato deve conter: `id`, `name`, `cards`, `createdAt`

## Atalhos e Dicas

### Busca:
- Pressione Enter no campo de busca para buscar rapidamente
- Use a sintaxe do Scryfall para buscas avançadas
- Combine filtros com busca de texto para resultados precisos

### Visualização:
- Clique em uma carta para ver detalhes em tamanho maior
- Use o controle de tamanho para adaptar à sua preferência
- O layout é responsivo e se adapta ao tamanho da tela

### Decks:
- Não há limite de cartas por deck
- Você pode ter quantos decks quiser (limitado pelo localStorage)
- Os decks são salvos automaticamente no navegador
- Exporte seus decks regularmente para backup

## Resolução de Problemas

### As cartas não aparecem:
- Verifique sua conexão com a internet
- A API Scryfall pode estar temporariamente indisponível
- Tente buscar novamente após alguns segundos

### Deck não foi salvo:
- Verifique se você deu um nome ao deck
- Certifique-se de que há cartas no deck atual
- Verifique o espaço disponível no localStorage do navegador

### Importação falhou:
- Verifique se o arquivo JSON está no formato correto
- Certifique-se de que o arquivo não está corrompido
- Tente exportar um deck e comparar o formato

### Filtros não funcionam:
- Clique em "Limpar Filtros" e tente novamente
- Alguns filtros podem não retornar resultados se forem muito restritivos
- Combine menos filtros para resultados mais amplos

## Recursos Adicionais

### Sintaxe de Busca Scryfall:
- `t:creature` - busca por tipo
- `c:red` - busca por cor
- `cmc:3` - busca por custo de mana
- `r:rare` - busca por raridade
- `o:"flying"` - busca por texto no oráculo

Para mais informações: https://scryfall.com/docs/syntax

### Armazenamento:
- Os decks são salvos no localStorage do navegador
- Cada navegador tem seu próprio armazenamento
- Limpar dados do navegador apagará os decks salvos
- Use a exportação para fazer backup dos seus decks

## Suporte

Para problemas ou sugestões, abra uma issue no GitHub:
https://github.com/AleBL/magic-the-gathering-search/issues

