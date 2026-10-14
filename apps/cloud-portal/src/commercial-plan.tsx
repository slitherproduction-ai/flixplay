import React from 'react';

const yearlyPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(24.9);

export function CommercialPlan() {
  return <section className="commercial-plan" aria-labelledby="plan-heading">
    <div className="plan-heading">
      <div>
        <p className="eyebrow">LICENCIAMENTO DO APLICATIVO</p>
        <h2 id="plan-heading">Plano ELVANOQ Play</h2>
      </div>
      <span className="plan-status">Pré-lançamento</span>
    </div>
    <p className="muted">Licença anual de uso do aplicativo, individual por dispositivo. O plano não inclui canais, filmes, séries, listas IPTV ou acesso a provedores de conteúdo.</p>
    <div className="plan-price"><strong>{yearlyPrice}</strong><span>/ dispositivo / ano</span></div>
    <ul className="plan-benefits">
      <li>Licenciamento independente dos serviços de conteúdo</li>
      <li>Consulta de licenças associadas à sua conta</li>
      <li>Gerenciamento dos dispositivos vinculados</li>
    </ul>
    <p className="plan-disclaimer" role="note">Valor de referência sujeito às condições comerciais e ao canal de distribuição. Vendas e renovações online ainda não estão disponíveis. Nenhuma cobrança é efetuada neste portal.</p>
  </section>;
}
