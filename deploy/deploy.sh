#!/usr/bin/env bash
# Script de instalação/atualização do app Heliar na instância Lightsail (Ubuntu).
# Rode como root (ou com sudo) DEPOIS de ter copiado a pasta "heliar-server" inteira
# para /opt/heliar/app na instância (veja DEPLOY.md para o comando de envio).
#
# Uso:
#   sudo DOMINIO="garantias.trokservice.com.br" EMAIL_ADMIN="voce@trokservice.com.br" bash deploy.sh
#
# É seguro rodar de novo (ex.: depois de subir uma atualização do código) — ele reinstala
# dependências, reinicia o serviço e recarrega o Caddy sem apagar dados.

set -euo pipefail

APP_DIR="/opt/heliar/app"
DATA_DIR="/opt/heliar/data"
SERVICE_USER="heliar"
DOMINIO="${DOMINIO:-}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Rode este script como root (ex.: sudo bash deploy.sh)" >&2
  exit 1
fi

if [ ! -d "$APP_DIR/server" ]; then
  echo "Não encontrei $APP_DIR/server — copie a pasta heliar-server para $APP_DIR antes de rodar este script." >&2
  exit 1
fi

echo "== 1/8: pacotes básicos =="
apt-get update -y
apt-get install -y curl ca-certificates gnupg ufw

echo "== 2/8: Node.js (LTS) =="
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt-get install -y nodejs
else
  echo "Node já instalado: $(node -v)"
fi

echo "== 3/8: Caddy (proxy reverso + HTTPS automático) =="
if ! command -v caddy >/dev/null 2>&1; then
  apt-get install -y debian-keyring debian-archive-keyring apt-transport-https
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | tee /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -y
  apt-get install -y caddy
else
  echo "Caddy já instalado: $(caddy version)"
fi

echo "== 4/8: usuário de serviço e pastas de dados =="
id -u "$SERVICE_USER" >/dev/null 2>&1 || useradd --system --home "$APP_DIR" --shell /usr/sbin/nologin "$SERVICE_USER"
mkdir -p "$DATA_DIR/uploads"
chown -R "$SERVICE_USER:$SERVICE_USER" "$APP_DIR" "$DATA_DIR"

echo "== 5/8: variáveis de ambiente (.env) =="
ENV_FILE="$APP_DIR/server/.env"
if [ ! -f "$ENV_FILE" ]; then
  JWT_SECRET_GERADO="$(openssl rand -hex 48)"
  cat > "$ENV_FILE" <<EOF
PORT=3000
JWT_SECRET=$JWT_SECRET_GERADO
COOKIE_SECURE=true
DATA_DIR=$DATA_DIR
EOF
  chown "$SERVICE_USER:$SERVICE_USER" "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  echo "Criado $ENV_FILE com uma chave JWT gerada automaticamente."
else
  echo "$ENV_FILE já existe — mantendo como está."
fi

echo "== 6/8: instalando dependências do Node =="
cd "$APP_DIR/server"
sudo -u "$SERVICE_USER" npm install --omit=dev

echo "== 7/8: serviço systemd =="
cp "$APP_DIR/deploy/heliar.service" /etc/systemd/system/heliar.service
systemctl daemon-reload
systemctl enable heliar
systemctl restart heliar
sleep 1
systemctl --no-pager status heliar | head -8

echo "== 8/8: Caddy (proxy + HTTPS) =="
if [ -n "$DOMINIO" ]; then
  sed "s/garantias.trokservice.com.br/$DOMINIO/" "$APP_DIR/deploy/Caddyfile" > /etc/caddy/Caddyfile
else
  cp "$APP_DIR/deploy/Caddyfile" /etc/caddy/Caddyfile
  echo "AVISO: variável DOMINIO não informada — usando o domínio já escrito no Caddyfile do repositório."
fi
mkdir -p /var/log/caddy
systemctl enable caddy
systemctl restart caddy

echo "== firewall (ufw) =="
ufw allow OpenSSH || true
ufw allow 80/tcp || true
ufw allow 443/tcp || true
ufw --force enable || true

echo
echo "Feito. Se ainda não existe nenhum usuário administrador, crie um com:"
echo "  cd $APP_DIR/server && sudo -u $SERVICE_USER env \$(cat .env | xargs) ADMIN_NOME=\"Seu Nome\" ADMIN_LOGIN=\"admin\" ADMIN_SENHA=\"escolha-uma-senha-forte\" node seed-admin.js"
echo
echo "Depois confira: https://${DOMINIO:-<seu-dominio>}"
