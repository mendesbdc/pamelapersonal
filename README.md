# Pâmela Personal

Plataforma web para gerar treinos pré-montados e personalizados a partir das informações do aluno.

## MVP atual

- Questionário com nome, idade, altura, peso, objetivo, modalidade, nível, dias disponíveis, tempo de treino e restrições.
- Cadastro público de alunos com treino provisório gratuito.
- Login administrativo para sua esposa.
- Painel admin para criar alunos e novos admins.
- Registro de avaliação do aluno, com próxima reavaliação marcada para 3 meses depois.
- Geração de treino provisório para:
  - musculação;
  - natação;
  - corrida / atletismo;
  - funcional;
  - mobilidade.
- Ajustes automáticos por experiência, IMC estimado e possíveis limitações.
- Tela de resultado com frequência, intensidade, alertas e divisão por dias.

## Rodar o projeto

```bash
npm install
npm run dev
```

Depois acesse:

```text
http://127.0.0.1:5173
```

Login admin inicial:

```text
Email: admin@pamelapersonal.local
Senha: admin123
```

O `npm run dev` sobe o site na porta `5173` e a API na porta `3334`.

## Banco de dados

O projeto pode usar o mesmo servidor MySQL/MariaDB do seu bot, mas com um banco separado:

```text
pamelapersonal
```

Para criar o banco e as tabelas iniciais com usuário `root` sem senha:

```bash
npm run db:setup
```

O schema fica em `db/schema.sql`.

## Validar build

```bash
npm run build
```

## Próximos passos sugeridos

- Cadastro/login de alunos.
- Painel do personal para editar modelos de treino.
- Histórico de treinos gerados.
- Exportar treino em PDF ou enviar por WhatsApp.
- Biblioteca de exercícios com vídeos.
- Integração com pagamento/assinatura.
- Validação profissional antes de liberar treinos para casos com lesão ou condição médica.

