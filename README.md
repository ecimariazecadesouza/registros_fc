# Frequência MZS (Versão 3.0)

Sistema de controle de frequência e diário de classe integrado ao Google Sheets.

## Funcionalidades (V3.0)
- **Refatoração com Context API**: Gerenciamento de estado global otimizado e fim do prop-drilling.
- **Diário de Classe**: Registro completo de disciplinas e conteúdos ministrados por aula.
- **Configuração Escolar**: Gestão centralizada de feriados, disciplinas e bimestres.
- **Exclusão Inteligente**: Ao remover uma aula do diário, a frequência associada é automaticamente resetada.
- **Sincronização Batch**: Salvamento em lote para alta performance e suporte offline.

## Instalação e Configuração

### 1. Preparação da Planilha
A planilha deve conter as seguintes abas:
- `Protagonistas`: Cadastro de alunos.
- `Turmas`: Cadastro das classes.
- `Frequencia`: Histórico de presenças.
- `Configuracoes`: Ajustes do sistema.

### 2. Backend (Apps Script)
O código para o Google Apps Script está disponível no arquivo `apps-script-v3.js` neste repositório.
- Cole o código no editor de scripts da sua planilha.
- Publique como "App da Web" com acesso para "Qualquer pessoa".

### 3. Rodando o App Localmente
```bash
npm install
npm run dev
```

## Tecnologias
- React + Vite
- Context API
- Lucide React (Icons)
- Tailwind CSS
- Google Apps Script
