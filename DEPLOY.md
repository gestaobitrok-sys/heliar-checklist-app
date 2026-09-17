# Deploy do Heliar na AWS Lightsail

Este guia assume uma instância Lightsail Ubuntu já criada, com acesso SSH (chave .pem)
e um domínio (`garantias.trokservice.com.br`, ou o que você definir) que você controla.

## 0. Antes de começar

1. **IP estático**: no console do Lightsail, na aba "Networking" da instância, anexe um
   IP estático gratuito (se ainda não tiver um). Sem isso, o IP muda se a instância reiniciar
   e o domínio para de apontar pro lugar certo.
2. **Firewall do Lightsail** (different do firewall do próprio Ubuntu!): na mesma aba
   "Networking", libere as portas:
   - `22` (SSH) — já vem liberada
   - `80` (HTTP) — necessária pro Let's Encrypt validar o domínio
   - `443` (HTTPS)
3. **DNS**: no painel onde o domínio `trokservice.com.br` está registrado, crie um registro
   `A` para o subdomínio escolhido (ex.: `garantias`) apontando para o IP estático da
   instância. Pode levar de alguns minutos a algumas horas para propagar.

## 1. Enviar os arquivos para o servidor

Do seu computador (onde está a chave `.pem`), na pasta que contém `heliar-server/`:

```bash
rsync -avz --exclude 'server/data' --exclude 'server/node_modules' \
  -e "ssh -i /caminho/para/sua-chave.pem" \
  heliar-server/ USUARIO@IP_DA_INSTANCIA:/tmp/heliar-app/
```

Troque `USUARIO` por `ubuntu` (Ubuntu padrão) ou `bitnami` (blueprints Bitnami) — depende
do blueprint escolhido ao criar a instância. Troque `IP_DA_INSTANCIA` pelo IP estático.

## 2. Instalar

Entre na instância via SSH e mova os arquivos para o lugar definitivo:

```bash
ssh -i /caminho/para/sua-chave.pem USUARIO@IP_DA_INSTANCIA
sudo mkdir -p /opt/heliar/app
sudo cp -r /tmp/heliar-app/* /opt/heliar/app/
cd /opt/heliar/app
sudo DOMINIO="garantias.trokservice.com.br" bash deploy/deploy.sh
```

O script instala Node.js e Caddy (se ainda não estiverem instalados), cria o usuário de
sistema `heliar`, instala as dependências, gera uma chave de sessão (`JWT_SECRET`)
automaticamente, sobe o app como serviço systemd e configura o Caddy para servir com
HTTPS automático (Let's Encrypt) no domínio informado.

## 3. Criar o primeiro usuário administrador

```bash
cd /opt/heliar/app/server
sudo -u heliar env $(cat .env | xargs) ADMIN_NOME="Seu Nome" ADMIN_LOGIN="admin" ADMIN_SENHA="escolha-uma-senha-forte" node seed-admin.js
```

Guarde essa senha — é ela que você vai usar para o primeiro login e, de lá, cadastrar os
demais usuários pela aba "Usuários" do próprio app (só aparece pra quem é administrador).

## 4. Conferir

Abra `https://garantias.trokservice.com.br` (ou o domínio que você usou). Deve aparecer a
tela de login. Depois de entrar, teste registrar um atendimento e recarregar a página para
confirmar que os dados persistem no servidor.

Comandos úteis para checar se está tudo certo:

```bash
sudo systemctl status heliar      # status do app Node
sudo systemctl status caddy       # status do proxy/HTTPS
sudo journalctl -u heliar -f      # logs do app em tempo real
sudo journalctl -u caddy -f       # logs do Caddy (inclui emissão do certificado)
```

## 5. Atualizando o app depois (nova versão do código)

Repita o passo 1 (rsync) e depois, na instância:

```bash
cd /opt/heliar/app
sudo DOMINIO="garantias.trokservice.com.br" bash deploy/deploy.sh
```

Rodar de novo é seguro — não apaga banco de dados nem fotos (eles ficam em
`/opt/heliar/data`, fora da pasta da aplicação).

## 6. Backup

Pela aba "Cadastros" do app, um usuário administrador pode clicar em "Exportar backup
(.json)" a qualquer momento — isso baixa um arquivo com todos os cadastros, atendimentos
e fotos. Guarde esse arquivo em local seguro (ex.: Google Drive da empresa) periodicamente.

Também dá pra fazer backup direto no servidor (cópia do banco + fotos):

```bash
sudo tar -czf /tmp/heliar-backup-$(date +%F).tar.gz -C /opt/heliar/data .
```

## 7. Segurança — o que já vem configurado

- HTTPS automático via Let's Encrypt (renovação automática pelo Caddy)
- Senhas de usuário com hash bcrypt (nunca armazenadas em texto puro)
- Sessão por cookie `httpOnly` (não acessível via JavaScript no navegador) + `Secure`
  (só trafega por HTTPS)
- Limite de tentativas de login (10 min de bloqueio após várias tentativas erradas)
- Firewall do Ubuntu (`ufw`) liberando só SSH/HTTP/HTTPS
- O serviço do app roda com um usuário de sistema sem privilégios (`heliar`), não como root

O que fica por sua conta:
- Trocar a senha do usuário administrador padrão assim que possível (aba "Usuários" → "Trocar senha" no menu do seu usuário, no topo)
- Manter o Ubuntu atualizado (`sudo apt update && sudo apt upgrade`) de tempos em tempos
- Guardar a chave `.pem` da instância em local seguro
