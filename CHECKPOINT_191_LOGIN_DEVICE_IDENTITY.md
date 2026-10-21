# Checkpoint 191 — Identificação do dispositivo no login

Base: checkpoint 190 / versão em desenvolvimento 2.17.16.

## Entrega

- A tela de login exibe Endereço MAC e Chave do dispositivo.
- Em Android TV, Google TV e Fire TV a identificação fica no canto inferior direito.
- Em smartphone e tablet ela é exibida no rodapé, acima da versão e build.
- Os valores são gerados uma única vez por instalação e ficam no armazenamento seguro quando disponível.
- Não há cobrança, cadastro remoto, ativação ou integração de pagamento nesta etapa.

## Arquivos

- `app/login.tsx`
- `services/device/deviceIdentity.ts`
- `CHANGELOG.md`
