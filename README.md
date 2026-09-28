# 🛡️ SecureON Wallet — 4U.IA.BR

> **Webapp de Carteira Cripto Não-Custodial, Leve, Segura e Descentralizada para Ethereum & Tokens ERC-20.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Network](https://img.shields.io/badge/Network-Ethereum%20Mainnet%20%7C%20Sepolia-6366f1.svg)]()
[![Security: AES-256-GCM](https://img.shields.io/badge/Encryption-AES--256--GCM-06b6d4.svg)]()
[![PWA Ready](https://img.shields.io/badge/PWA-Installable-10b981.svg)]()

---

## 🌟 Visão Geral

O **SecureON Wallet** é um webapp de carteira de criptomoedas não-custodial desenvolvido para oferecer máxima segurança, privacidade e controle total sobre ativos digitais na Web3.

Suas chaves privadas são protegidas localmente no dispositivo através de criptografia **AES-256-GCM** e derivação segura via **PBKDF2 com 100.000 iterações**, garantindo que apenas você tenha acesso aos seus fundos. A aplicação opera diretamente no navegador, sem bancos de dados centrais nem custódia de terceiros, seguindo à risca o mantra sagrado do ecossistema cripto: **"Suas chaves, suas moedas"**.

---

## 🚀 Principais Recursos

- **🔐 Soberania Total (Não-Custodial & Zero-Knowledge):**
  - Criação ou importação de carteiras por **Seed Phrase (BIP-39)** de 12 ou 24 palavras.
  - Derivação de chaves conforme o padrão da indústria **BIP-44** (`m/44'/60'/0'/0/0`).
  - Criptografia local simétrica **AES-256-GCM** com autenticação de integridade contra adulterações.

- **⛓️ Conectividade Blockchain & Multi-Token:**
  - Consulta e exibição em tempo real do saldo em **Ethereum (ETH)** nativo e cotação aproximada em USD.
  - Suporte completo a múltiplos tokens **ERC-20** populares (USDT, USDC, DAI, WBTC, LINK, UNI) e cadastro de tokens customizados por endereço de contrato.
  - Sistema de conexão RPC inteligente com **múltiplos endpoints e fallback automático** (LlamaRPC, Ankr, Cloudflare).
  - Suporte nativo a redes **Ethereum Mainnet** e **Sepolia Testnet**.

- **💸 Envio e Recebimento Simplificados:**
  - Envio seguro com cálculo dinâmico de taxas de rede (**Gas Fee EIP-1559**).
  - Verificação de integridade e defesa ativa contra substituição maliciosa de endereços (*address tampering / clipboard hijack*).
  - Recebimento ágil com **QR Code HD gerado offline** e botão de cópia rápida.
  - Histórico de transações locais com link direto para o explorador de blocos **Etherscan**.

- **🛡️ Defesas Avançadas de Segurança:**
  - Proteção anti-força-bruta com atraso exponencial progressivo (*exponential backoff*).
  - Auto-limpeza de área de transferência (*clipboard auto-wipe*) com cronômetro regressivo de 30 segundos.
  - Bloqueio automático de sessão por inatividade (1, 5, 15 ou 30 minutos).
  - Indicador visual anti-phishing.

- **📱 PWA & Offline-First:**
  - Totalmente instalável como aplicativo nativo (PWA) no Android, iOS, Windows, Mac e Linux.
  - Interface responsiva com design moderno em estilo Glassmorphism e Cyberpunk 4U.

---

## 🛠️ Tecnologias Utilizadas

- **Ethers.js:** Interação RPC com a blockchain Ethereum, assinatura de transações e decodificação ABI de contratos ERC-20.
- **Web Cryptography API:** Cripto nativa de alto desempenho no navegador para PBKDF2 e AES-GCM.
- **QRCode.js:** Geração de QR codes vetoriais offline no cliente.
- **Tailwind CSS & Vanilla JS:** UI ultra-rápida, leve e responsiva, sem inchaço de frameworks pesados.

---

## 🌐 Acesso Online

- **Aplicação:** [https://4u.ia.br/app/wallet/](https://4u.ia.br/app/wallet/)
- **Tutorial & Guia:** [https://4u.ia.br/app/wallet/tutorial.html](https://4u.ia.br/app/wallet/tutorial.html)
- **Central de Ajuda:** [https://4u.ia.br/app/wallet/suporte.html](https://4u.ia.br/app/wallet/suporte.html)

---

## 📄 Licença

Distribuído sob licença aberta pelo time **4U-Labs / 4U.IA.BR**. Sinta-se livre para auditar, contribuir ou forkar o projeto.
