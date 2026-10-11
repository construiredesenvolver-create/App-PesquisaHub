# Backup e restauração do PesquisaHub

## Como funciona
- Todo dia às 03:30 (horário de Brasília) a rotina **Backup diário do banco** (aba *Actions* do GitHub) exporta o banco inteiro do app.
- O arquivo é **criptografado com a senha** cadastrada no secret `BACKUP_SENHA`. Sem essa senha ninguém consegue abrir o backup — **guarde a senha em local seguro** (ex.: gerenciador de senhas). Se ela for perdida, os backups não podem ser abertos.
- Cada backup fica guardado por **30 dias**, em *Actions → Backup diário do banco → (execução do dia) → Artifacts*.
- Conteúdo: pesquisas, perguntas, alternativas, respondentes, respostas, usuários (perfis e logins), departamentos, acessos especiais, auditoria, regras de acesso e funções do banco.
- Não inclui: a imagem da logo (basta enviar de novo em Configurações) e os secrets das Edge Functions.

## Como baixar e abrir um backup
1. GitHub → *Actions* → **Backup diário do banco** → clique na execução da data desejada → em **Artifacts**, baixe o arquivo.
2. Extraia o `.zip` baixado: dentro há um arquivo `pesquisahub-backup-AAAA-MM-DD_HHMM.tar.gz.gpg`.
3. Para abrir é preciso o programa **GnuPG** (Windows: Gpg4win; ou peça ajuda ao Claude). Comando:
   `gpg -d pesquisahub-backup-AAAA-MM-DD_HHMM.tar.gz.gpg > backup.tar.gz` (vai pedir a senha)
4. Extraia o `backup.tar.gz`. Dentro da pasta `backup` há:
   - `01_app_public.sql` — estrutura e dados do app
   - `02_contas_login.sql` — contas de login
   - `contagens.txt` — quantidades para conferência

## Como restaurar num projeto Supabase NOVO (em caso de perda total)
> Restaurar por cima do projeto atual não é recomendado. O caminho seguro é criar um projeto novo, restaurar nele, conferir e só então apontar o app para ele.

1. Crie um projeto novo no Supabase (região São Paulo).
2. **SQL Editor → New query**, cole o conteúdo de `02_contas_login.sql` → *Run* (recria os logins).
3. **SQL Editor → New query**, cole o conteúdo de `01_app_public.sql` → *Run*.
   - O aviso `schema "public" already exists` é normal e pode ser ignorado.
4. **SQL Editor → New query**, cole e rode o bloco abaixo (gatilho de novos usuários e armazenamento da logo, que ficam fora do backup):

```sql
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into storage.buckets (id, name, public) values ('fotos', 'fotos', true)
on conflict (id) do nothing;

drop policy if exists fotos_upload_respostas on storage.objects;
create policy fotos_upload_respostas on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = 'respostas');

drop policy if exists fotos_upload_marca on storage.objects;
create policy fotos_upload_marca on storage.objects for insert to authenticated
  with check (bucket_id = 'fotos' and (storage.foldername(name))[1] = 'marca' and public.is_admin());
```

5. Confira as quantidades com `contagens.txt`:
```sql
select 'pesquisas', count(*) from public.surveys
union all select 'respostas', count(*) from public.answers
union all select 'usuarios', count(*) from public.profiles;
```
6. Republique as Edge Functions (`admin-usuarios` e `analisar-sentimento`) e cadastre os secrets delas no projeto novo.
7. Atualize `src/services/config.ts` (URL e chave publishable do projeto novo) e os secrets `SUPABASE_DB_URL` do GitHub.
