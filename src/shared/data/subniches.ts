export interface Subniche {
  value: string;
  label: string;
  category: string;
}

export const SUBNICHES: Subniche[] = [
  // Agronegócio
  { value: "pecuaria", label: "Pecuária", category: "Agronegócio" },
  { value: "agricultura", label: "Agricultura", category: "Agronegócio" },
  { value: "produtor-rural", label: "Produtor Rural", category: "Agronegócio" },
  { value: "agronomia", label: "Agronomia", category: "Agronegócio" },
  { value: "veterinaria-rural", label: "Veterinária Rural", category: "Agronegócio" },
  
  // Animais & Pets
  { value: "cuidados-com-pets", label: "Cuidados com Pets", category: "Animais & Pets" },
  { value: "adestramento", label: "Adestramento", category: "Animais & Pets" },
  { value: "veterinaria", label: "Veterinária", category: "Animais & Pets" },
  { value: "perfil-de-pet", label: "Perfil de Pet", category: "Animais & Pets" },
  { value: "pet-sitting", label: "Pet Sitting", category: "Animais & Pets" },
  { value: "animais-silvestres", label: "Animais Silvestres", category: "Animais & Pets" },
  { value: "ativismo-animal", label: "Ativismo Animal", category: "Animais & Pets" },
  { value: "aquarismo", label: "Aquarismo", category: "Animais & Pets" },
  
  // Arquitetura & Construção
  { value: "arquitetura", label: "Arquitetura", category: "Arquitetura & Construção" },
  { value: "design-de-interiores", label: "Design de Interiores", category: "Arquitetura & Construção" },
  { value: "paisagismo", label: "Paisagismo", category: "Arquitetura & Construção" },
  { value: "reforma-retrofit", label: "Reforma & Retrofit", category: "Arquitetura & Construção" },
  { value: "engenharia-civil", label: "Engenharia Civil", category: "Arquitetura & Construção" },
  { value: "marcenaria", label: "Marcenaria", category: "Arquitetura & Construção" },
  { value: "eletrica-hidraulica", label: "Elétrica & Hidráulica", category: "Arquitetura & Construção" },
  
  // Arte & Design
  { value: "ilustracao", label: "Ilustração", category: "Arte & Design" },
  { value: "pintura", label: "Pintura", category: "Arte & Design" },
  { value: "escultura", label: "Escultura", category: "Arte & Design" },
  { value: "arte-digital", label: "Arte Digital", category: "Arte & Design" },
  { value: "design-grafico", label: "Design Gráfico", category: "Arte & Design" },
  { value: "fotografia-artistica", label: "Fotografia Artística", category: "Arte & Design" },
  { value: "street-art", label: "Street Art", category: "Arte & Design" },
  
  // Ator/Atriz & Teatro
  { value: "teatro", label: "Teatro", category: "Ator/Atriz & Teatro" },
  { value: "cinema", label: "Cinema", category: "Ator/Atriz & Teatro" },
  { value: "tv-novelas", label: "TV & Novelas", category: "Ator/Atriz & Teatro" },
  { value: "mirim", label: "Mirim", category: "Ator/Atriz & Teatro" },
  { value: "esquetes-comedia", label: "Esquetes & Comédia", category: "Ator/Atriz & Teatro" },
  { value: "dublagem", label: "Dublagem", category: "Ator/Atriz & Teatro" },
  { value: "musical", label: "Musical", category: "Ator/Atriz & Teatro" },
  
  // Audiovisual & Produção
  { value: "fotografia", label: "Fotografia", category: "Audiovisual & Produção" },
  { value: "videomaking", label: "Videomaking", category: "Audiovisual & Produção" },
  { value: "edicao-de-video", label: "Edição de Vídeo", category: "Audiovisual & Produção" },
  { value: "cinema-av", label: "Cinema", category: "Audiovisual & Produção" },
  { value: "producao-de-conteudo", label: "Produção de Conteúdo", category: "Audiovisual & Produção" },
  { value: "motion-design", label: "Motion Design", category: "Audiovisual & Produção" },
  { value: "sonorizacao", label: "Sonorização", category: "Audiovisual & Produção" },
  { value: "direcao-de-fotografia", label: "Direção de Fotografia", category: "Audiovisual & Produção" },
  
  // Automobilismo & Veículos
  { value: "carros", label: "Carros", category: "Automobilismo & Veículos" },
  { value: "motos", label: "Motos", category: "Automobilismo & Veículos" },
  { value: "caminhoes", label: "Caminhões", category: "Automobilismo & Veículos" },
  { value: "mecanica-automotiva", label: "Mecânica Automotiva", category: "Automobilismo & Veículos" },
  { value: "piloto-profissional", label: "Piloto Profissional", category: "Automobilismo & Veículos" },
  { value: "customizacao", label: "Customização", category: "Automobilismo & Veículos" },
  { value: "motorista-de-aplicativo", label: "Motorista de Aplicativo", category: "Automobilismo & Veículos" },
  { value: "review-de-veiculos", label: "Review de Veículos", category: "Automobilismo & Veículos" },
  
  // Bebidas
  { value: "vinhos-sommelier", label: "Vinhos & Sommelier", category: "Bebidas" },
  { value: "cervejas-chopp", label: "Cervejas & Chopp", category: "Bebidas" },
  { value: "destilados", label: "Destilados", category: "Bebidas" },
  { value: "drinks-coquetelaria", label: "Drinks & Coquetelaria", category: "Bebidas" },
  { value: "bartender", label: "Bartender", category: "Bebidas" },
  { value: "cafe-barismo", label: "Café & Barismo", category: "Bebidas" },
  { value: "review-de-bebidas", label: "Review de Bebidas", category: "Bebidas" },
  
  // Beleza & Estética
  { value: "maquiagem", label: "Maquiagem", category: "Beleza & Estética" },
  { value: "maquiagem-artistica", label: "Maquiagem Artística", category: "Beleza & Estética" },
  { value: "skincare", label: "Skincare", category: "Beleza & Estética" },
  { value: "cabelo-coloracao", label: "Cabelo & Coloração", category: "Beleza & Estética" },
  { value: "unhas-nail-art", label: "Unhas & Nail Art", category: "Beleza & Estética" },
  { value: "perfumaria", label: "Perfumaria", category: "Beleza & Estética" },
  { value: "beleza-masculina", label: "Beleza Masculina", category: "Beleza & Estética" },
  { value: "estetica-corporal", label: "Estética Corporal", category: "Beleza & Estética" },
  { value: "pele-madura", label: "Pele Madura (40+)", category: "Beleza & Estética" },
  { value: "review-de-produtos-beleza", label: "Review de Produtos", category: "Beleza & Estética" },
  
  // Cabelo
  { value: "cabelo-cacheado", label: "Cabelo Cacheado", category: "Cabelo" },
  { value: "cabelo-crespo", label: "Cabelo Crespo", category: "Cabelo" },
  { value: "cabelo-liso", label: "Cabelo Liso", category: "Cabelo" },
  { value: "coloracao-descoloracao", label: "Coloração & Descoloração", category: "Cabelo" },
  { value: "penteados-trancas", label: "Penteados & Tranças", category: "Cabelo" },
  { value: "cuidados-capilares", label: "Cuidados Capilares", category: "Cabelo" },
  { value: "transicao-capilar", label: "Transição Capilar", category: "Cabelo" },
  { value: "profissional-cabeleireiro", label: "Profissional Cabeleireiro", category: "Cabelo" },
  
  // Casa & Decoração
  { value: "decoracao", label: "Decoração", category: "Casa & Decoração" },
  { value: "organizacao", label: "Organização", category: "Casa & Decoração" },
  { value: "limpeza-higiene", label: "Limpeza & Higiene", category: "Casa & Decoração" },
  { value: "financas-domesticas", label: "Finanças Domésticas", category: "Casa & Decoração" },
  { value: "rotina-do-lar", label: "Rotina do Lar", category: "Casa & Decoração" },
  { value: "compras-economia", label: "Compras & Economia", category: "Casa & Decoração" },
  { value: "diy-domestico", label: "DIY Doméstico", category: "Casa & Decoração" },
  { value: "casa-inteligente", label: "Casa Inteligente", category: "Casa & Decoração" },
  
  // Ciência & Tecnologia
  { value: "fisica", label: "Física", category: "Ciência & Tecnologia" },
  { value: "quimica", label: "Química", category: "Ciência & Tecnologia" },
  { value: "biologia", label: "Biologia", category: "Ciência & Tecnologia" },
  { value: "matematica", label: "Matemática", category: "Ciência & Tecnologia" },
  { value: "astronomia", label: "Astronomia", category: "Ciência & Tecnologia" },
  { value: "tecnologia-inovacao", label: "Tecnologia & Inovação", category: "Ciência & Tecnologia" },
  { value: "engenharia", label: "Engenharia", category: "Ciência & Tecnologia" },
  { value: "curiosidades-cientificas", label: "Curiosidades Científicas", category: "Ciência & Tecnologia" },
  
  // Comédia & Humor
  { value: "stand-up", label: "Stand-Up", category: "Comédia & Humor" },
  { value: "esquetes", label: "Esquetes", category: "Comédia & Humor" },
  { value: "personagens", label: "Personagens", category: "Comédia & Humor" },
  { value: "imitacoes-parodias", label: "Imitações & Paródias", category: "Comédia & Humor" },
  { value: "pegadinhas", label: "Pegadinhas", category: "Comédia & Humor" },
  { value: "dublagem-comica", label: "Dublagem Cômica", category: "Comédia & Humor" },
  { value: "reacts", label: "Reacts", category: "Comédia & Humor" },
  
  // Comida & Gastronomia
  { value: "receitas", label: "Receitas", category: "Comida & Gastronomia" },
  { value: "gastronomia-profissional", label: "Gastronomia Profissional", category: "Comida & Gastronomia" },
  { value: "confeitaria-doces", label: "Confeitaria & Doces", category: "Comida & Gastronomia" },
  { value: "churrasco", label: "Churrasco", category: "Comida & Gastronomia" },
  { value: "comida-vegetariana", label: "Comida Vegetariana", category: "Comida & Gastronomia" },
  { value: "comida-vegana", label: "Comida Vegana", category: "Comida & Gastronomia" },
  { value: "comida-fit-saudavel", label: "Comida Fit & Saudável", category: "Comida & Gastronomia" },
  { value: "review-de-restaurantes", label: "Review de Restaurantes", category: "Comida & Gastronomia" },
  { value: "panificacao", label: "Panificação", category: "Comida & Gastronomia" },
  
  // Cultura Pop & Geek
  { value: "series-filmes", label: "Séries & Filmes", category: "Cultura Pop & Geek" },
  { value: "quadrinhos-hqs", label: "Quadrinhos & HQs", category: "Cultura Pop & Geek" },
  { value: "anime-manga", label: "Anime & Mangá", category: "Cultura Pop & Geek" },
  { value: "cosplay", label: "Cosplay", category: "Cultura Pop & Geek" },
  { value: "colecionaveis", label: "Colecionáveis", category: "Cultura Pop & Geek" },
  { value: "k-pop-j-pop", label: "K-Pop & J-Pop", category: "Cultura Pop & Geek" },
  { value: "festivais-eventos", label: "Festivais & Eventos", category: "Cultura Pop & Geek" },
  { value: "super-herois", label: "Super-heróis", category: "Cultura Pop & Geek" },
  { value: "cultura-nerd", label: "Cultura Nerd", category: "Cultura Pop & Geek" },
  
  // Curiosidades
  { value: "curiosidades-historicas", label: "Curiosidades Históricas", category: "Curiosidades" },
  { value: "curiosidades-culturais", label: "Curiosidades Culturais", category: "Curiosidades" },
  { value: "curiosidades-tecnologicas", label: "Curiosidades Tecnológicas", category: "Curiosidades" },
  { value: "geografia-viagens", label: "Geografia & Viagens", category: "Curiosidades" },
  { value: "fatos-interessantes", label: "Fatos Interessantes", category: "Curiosidades" },
  { value: "misterios-teorias", label: "Mistérios & Teorias", category: "Curiosidades" },
  
  // Dança
  { value: "danca-profissional", label: "Dança Profissional", category: "Dança" },
  { value: "coreografia", label: "Coreografia", category: "Dança" },
  { value: "danca-de-salao", label: "Dança de Salão", category: "Dança" },
  { value: "ballet", label: "Ballet", category: "Dança" },
  { value: "danca-urbana", label: "Dança Urbana", category: "Dança" },
  { value: "dancas-regionais", label: "Danças Regionais", category: "Dança" },
  { value: "professor-de-danca", label: "Professor de Dança", category: "Dança" },
  { value: "dancas-em-alta", label: "Danças em alta", category: "Dança" },
  
  // Diversidade & Inclusão
  { value: "lgbtqiapn", label: "LGBTQIAPN+", category: "Diversidade & Inclusão" },
  { value: "antirracismo", label: "Antirracismo", category: "Diversidade & Inclusão" },
  { value: "pcd", label: "PCD (Pessoa com Deficiência)", category: "Diversidade & Inclusão" },
  { value: "autismo-neurodivergencia", label: "Autismo & Neurodivergência", category: "Diversidade & Inclusão" },
  { value: "vitiligo", label: "Vitiligo", category: "Diversidade & Inclusão" },
  { value: "empoderamento-feminino", label: "Empoderamento Feminino", category: "Diversidade & Inclusão" },
  { value: "inclusao-social", label: "Inclusão Social", category: "Diversidade & Inclusão" },
  
  // DIY - Faça Você Mesmo
  { value: "artesanato", label: "Artesanato", category: "DIY - Faça Você Mesmo" },
  { value: "marcenaria-diy", label: "Marcenaria", category: "DIY - Faça Você Mesmo" },
  { value: "decoracao-diy", label: "Decoração DIY", category: "DIY - Faça Você Mesmo" },
  { value: "consertos-domesticos", label: "Consertos Domésticos", category: "DIY - Faça Você Mesmo" },
  { value: "restauracao", label: "Restauração", category: "DIY - Faça Você Mesmo" },
  { value: "bijuterias-acessorios", label: "Bijuterias & Acessórios", category: "DIY - Faça Você Mesmo" },
  { value: "roupas-customizacao", label: "Roupas & Customização", category: "DIY - Faça Você Mesmo" },
  { value: "brinquedos", label: "Brinquedos", category: "DIY - Faça Você Mesmo" },
  { value: "upcycling", label: "Upcycling", category: "DIY - Faça Você Mesmo" },
  
  // Educação
  { value: "ensino-infantil", label: "Ensino Infantil", category: "Educação" },
  { value: "ensino-fundamental", label: "Ensino Fundamental", category: "Educação" },
  { value: "ensino-medio", label: "Ensino Médio", category: "Educação" },
  { value: "ensino-superior", label: "Ensino Superior", category: "Educação" },
  { value: "idiomas", label: "Idiomas", category: "Educação" },
  { value: "preparatorio-vestibular", label: "Preparatório & Vestibular", category: "Educação" },
  { value: "educacao-tecnologica", label: "Educação Tecnológica", category: "Educação" },
  { value: "pedagogia", label: "Pedagogia", category: "Educação" },
  { value: "dicas-de-estudo", label: "Dicas de Estudo", category: "Educação" },
  { value: "educacao-especial", label: "Educação Especial", category: "Educação" },
  
  // Empreendedorismo & Negócios
  { value: "microempreendedorismo", label: "Microempreendedorismo", category: "Empreendedorismo & Negócios" },
  { value: "empreendedorismo-digital", label: "Empreendedorismo Digital", category: "Empreendedorismo & Negócios" },
  { value: "empreendedorismo-feminino", label: "Empreendedorismo Feminino", category: "Empreendedorismo & Negócios" },
  { value: "marketing-digital", label: "Marketing Digital", category: "Empreendedorismo & Negócios" },
  { value: "vendas-online", label: "Vendas Online", category: "Empreendedorismo & Negócios" },
  { value: "dropshipping-ecommerce", label: "Dropshipping & E-commerce", category: "Empreendedorismo & Negócios" },
  { value: "infoprodutos", label: "Infoprodutos", category: "Empreendedorismo & Negócios" },
  { value: "mentoria-empresarial", label: "Mentoria Empresarial", category: "Empreendedorismo & Negócios" },
  { value: "financas-para-negocios", label: "Finanças para Negócios", category: "Empreendedorismo & Negócios" },
  
  // Esporte & Atletas
  { value: "futebol", label: "Futebol", category: "Esporte & Atletas" },
  { value: "basquete", label: "Basquete", category: "Esporte & Atletas" },
  { value: "volei", label: "Vôlei", category: "Esporte & Atletas" },
  { value: "tenis", label: "Tênis", category: "Esporte & Atletas" },
  { value: "corrida-atletismo", label: "Corrida & Atletismo", category: "Esporte & Atletas" },
  { value: "natacao", label: "Natação", category: "Esporte & Atletas" },
  { value: "ciclismo", label: "Ciclismo", category: "Esporte & Atletas" },
  { value: "artes-marciais-lutas", label: "Artes Marciais & Lutas", category: "Esporte & Atletas" },
  { value: "esportes-radicais", label: "Esportes Radicais", category: "Esporte & Atletas" },
  { value: "ex-atleta", label: "Ex-Atleta", category: "Esporte & Atletas" },
  { value: "jornalismo-esportivo", label: "Jornalismo Esportivo", category: "Esporte & Atletas" },
  { value: "comentarista-esportivo", label: "Comentarista Esportivo", category: "Esporte & Atletas" },
  
  // Lifestyle
  { value: "rotina-dia-a-dia", label: "Rotina & Dia a Dia", category: "Lifestyle" },
  { value: "lifestyle-de-luxo", label: "Lifestyle de Luxo", category: "Lifestyle" },
  { value: "autocuidado", label: "Autocuidado", category: "Lifestyle" },
  { value: "desenvolvimento-pessoal", label: "Desenvolvimento Pessoal", category: "Lifestyle" },
  { value: "qualidade-de-vida", label: "Qualidade de Vida", category: "Lifestyle" },
  { value: "slow-living", label: "Slow Living", category: "Lifestyle" },
  
  // Família & Relacionamentos
  { value: "maternidade", label: "Maternidade", category: "Família & Relacionamentos" },
  { value: "paternidade", label: "Paternidade", category: "Família & Relacionamentos" },
  { value: "casal", label: "Casal", category: "Família & Relacionamentos" },
  { value: "gravidez-gestacao", label: "Gravidez & Gestação", category: "Família & Relacionamentos" },
  { value: "adocao", label: "Adoção", category: "Família & Relacionamentos" },
  { value: "familia-monoparental", label: "Família Monoparental", category: "Família & Relacionamentos" },
  { value: "familia-lgbtqiapn", label: "Família LGBTQIAPN+", category: "Família & Relacionamentos" },
  { value: "educacao-parental", label: "Educação Parental", category: "Família & Relacionamentos" },
  
  // Filmes & Séries
  { value: "cinema-fs", label: "Cinema", category: "Filmes & Séries" },
  { value: "streaming", label: "Streaming", category: "Filmes & Séries" },
  { value: "series-novelas", label: "Séries & Novelas", category: "Filmes & Séries" },
  { value: "documentarios", label: "Documentários", category: "Filmes & Séries" },
  { value: "true-crime", label: "True Crime", category: "Filmes & Séries" },
  { value: "doramas", label: "Doramas", category: "Filmes & Séries" },
  { value: "filmes-de-super-herois", label: "Filmes de Super-heróis", category: "Filmes & Séries" },
  { value: "terror-suspense", label: "Terror & Suspense", category: "Filmes & Séries" },
  { value: "comedia-fs", label: "Comédia", category: "Filmes & Séries" },
  { value: "review-critica", label: "Review & Crítica", category: "Filmes & Séries" },
  { value: "conteudo-infantil", label: "Conteúdo Infantil", category: "Filmes & Séries" },
  { value: "cortes", label: "Cortes", category: "Filmes & Séries" },
  
  // Finanças & Investimentos
  { value: "educacao-financeira", label: "Educação Financeira", category: "Finanças & Investimentos" },
  { value: "investimentos-em-acoes", label: "Investimentos em Ações", category: "Finanças & Investimentos" },
  { value: "renda-fixa", label: "Renda Fixa", category: "Finanças & Investimentos" },
  { value: "fundos-de-investimento", label: "Fundos de Investimento", category: "Finanças & Investimentos" },
  { value: "criptomoedas", label: "Criptomoedas", category: "Finanças & Investimentos" },
  { value: "investimento-imobiliario", label: "Investimento Imobiliário", category: "Finanças & Investimentos" },
  { value: "milhas-pontos", label: "Milhas & Pontos", category: "Finanças & Investimentos" },
  { value: "planejamento-financeiro", label: "Planejamento Financeiro", category: "Finanças & Investimentos" },
  
  // Fitness & Treino
  { value: "musculacao", label: "Musculação", category: "Fitness & Treino" },
  { value: "crossfit", label: "Crossfit", category: "Fitness & Treino" },
  { value: "funcional", label: "Funcional", category: "Fitness & Treino" },
  { value: "pilates", label: "Pilates", category: "Fitness & Treino" },
  { value: "yoga", label: "Yoga", category: "Fitness & Treino" },
  { value: "corrida-ft", label: "Corrida", category: "Fitness & Treino" },
  { value: "natacao-ft", label: "Natação", category: "Fitness & Treino" },
  { value: "personal-trainer", label: "Personal Trainer", category: "Fitness & Treino" },
  { value: "emagrecimento", label: "Emagrecimento", category: "Fitness & Treino" },
  { value: "ganho-de-massa", label: "Ganho de Massa", category: "Fitness & Treino" },
  { value: "alongamento-mobilidade", label: "Alongamento & Mobilidade", category: "Fitness & Treino" },
  { value: "nutricionista", label: "Nutricionista", category: "Fitness & Treino" },
  
  // Gaming
  { value: "pc-gaming", label: "PC Gaming", category: "Gaming" },
  { value: "console-playstation", label: "Console (PlayStation)", category: "Gaming" },
  { value: "console-xbox", label: "Console (Xbox)", category: "Gaming" },
  { value: "console-nintendo", label: "Console (Nintendo)", category: "Gaming" },
  { value: "mobile-gaming", label: "Mobile Gaming", category: "Gaming" },
  { value: "e-sports", label: "E-sports", category: "Gaming" },
  { value: "streamer", label: "Streamer", category: "Gaming" },
  { value: "pro-player", label: "Pro Player", category: "Gaming" },
  { value: "comentarista-narrador", label: "Comentarista & Narrador", category: "Gaming" },
  { value: "mmorpg", label: "MMORPG", category: "Gaming" },
  { value: "fps", label: "FPS", category: "Gaming" },
  { value: "moba", label: "MOBA", category: "Gaming" },
  { value: "battle-royale", label: "Battle Royale", category: "Gaming" },
  { value: "rpg", label: "RPG", category: "Gaming" },
  { value: "simulacao", label: "Simulação", category: "Gaming" },
  
  // Jardinagem & Plantas
  { value: "jardinagem", label: "Jardinagem", category: "Jardinagem & Plantas" },
  { value: "plantas-ornamentais", label: "Plantas Ornamentais", category: "Jardinagem & Plantas" },
  { value: "horta-caseira", label: "Horta Caseira", category: "Jardinagem & Plantas" },
  { value: "plantas-internas", label: "Plantas Internas", category: "Jardinagem & Plantas" },
  { value: "paisagismo-jp", label: "Paisagismo", category: "Jardinagem & Plantas" },
  { value: "suculentas-cactos", label: "Suculentas & Cactos", category: "Jardinagem & Plantas" },
  
  // Literatura & Livros
  { value: "autor", label: "Autor", category: "Literatura & Livros" },
  { value: "poeta", label: "Poeta", category: "Literatura & Livros" },
  { value: "booktuber-booktoker", label: "BookTuber/BookToker", category: "Literatura & Livros" },
  { value: "literatura-nacional", label: "Literatura Nacional", category: "Literatura & Livros" },
  { value: "contos-cronicas", label: "Contos & Crônicas", category: "Literatura & Livros" },
  { value: "dicas-de-leitura", label: "Dicas de Leitura", category: "Literatura & Livros" },
  { value: "clube-do-livro", label: "Clube do Livro", category: "Literatura & Livros" },
  
  // Moda & Estilo
  { value: "moda-feminina", label: "Moda Feminina", category: "Moda & Estilo" },
  { value: "moda-masculina", label: "Moda Masculina", category: "Moda & Estilo" },
  { value: "moda-infantil", label: "Moda Infantil", category: "Moda & Estilo" },
  { value: "moda-plus-size", label: "Moda Plus Size", category: "Moda & Estilo" },
  { value: "personal-stylist", label: "Personal Stylist", category: "Moda & Estilo" },
  { value: "historia-da-moda", label: "História da Moda", category: "Moda & Estilo" },
  { value: "acessorios", label: "Acessórios", category: "Moda & Estilo" },
  { value: "calcados", label: "Calçados", category: "Moda & Estilo" },
  { value: "moda-40", label: "Moda 40+", category: "Moda & Estilo" },
  
  // Motivação & Desenvolvimento
  { value: "motivacao-inspiracao", label: "Motivação & Inspiração", category: "Motivação & Desenvolvimento" },
  { value: "coaching", label: "Coaching", category: "Motivação & Desenvolvimento" },
  { value: "pnl", label: "PNL", category: "Motivação & Desenvolvimento" },
  { value: "produtividade", label: "Produtividade", category: "Motivação & Desenvolvimento" },
  { value: "mentalidade-mindset", label: "Mentalidade & Mindset", category: "Motivação & Desenvolvimento" },
  { value: "autoconhecimento", label: "Autoconhecimento", category: "Motivação & Desenvolvimento" },
  { value: "espiritualidade", label: "Espiritualidade", category: "Motivação & Desenvolvimento" },
  { value: "meditacao-mindfulness", label: "Meditação & Mindfulness", category: "Motivação & Desenvolvimento" },
  
  // Música
  { value: "cantor-cantora", label: "Cantor/Cantora", category: "Música" },
  { value: "compositor", label: "Compositor", category: "Música" },
  { value: "instrumentista", label: "Instrumentista", category: "Música" },
  { value: "dj-producao-musical", label: "DJ & Produção Musical", category: "Música" },
  { value: "cover-tributo", label: "Cover & Tributo", category: "Música" },
  
  // Notícias & Jornalismo
  { value: "jornalismo", label: "Jornalismo", category: "Notícias & Jornalismo" },
  { value: "apresentador-ancora", label: "Apresentador/Âncora", category: "Notícias & Jornalismo" },
  { value: "comentarista", label: "Comentarista", category: "Notícias & Jornalismo" },
  { value: "politica", label: "Política", category: "Notícias & Jornalismo" },
  { value: "economia-mercado", label: "Economia & Mercado", category: "Notícias & Jornalismo" },
  { value: "esportes", label: "Esportes", category: "Notícias & Jornalismo" },
  { value: "entretenimento-celebridades", label: "Entretenimento & Celebridades", category: "Notícias & Jornalismo" },
  { value: "tecnologia-nj", label: "Tecnologia", category: "Notícias & Jornalismo" },
  
  // Podcast
  { value: "entrevistas", label: "Entrevistas", category: "Podcast" },
  { value: "true-crime-podcast", label: "True Crime", category: "Podcast" },
  { value: "comedia-podcast", label: "Comédia", category: "Podcast" },
  { value: "cultura-pop", label: "Cultura Pop", category: "Podcast" },
  { value: "esportes-podcast", label: "Esportes", category: "Podcast" },
  { value: "negocios-carreira", label: "Negócios & Carreira", category: "Podcast" },
  { value: "saude-bem-estar-podcast", label: "Saúde & Bem-estar", category: "Podcast" },
  { value: "tecnologia-podcast", label: "Tecnologia", category: "Podcast" },
  { value: "historia", label: "História", category: "Podcast" },
  { value: "storytelling", label: "Storytelling", category: "Podcast" },
  { value: "cortes-clips", label: "Cortes & Clips", category: "Podcast" },
  
  // Saúde & Bem-estar
  { value: "nutricao", label: "Nutrição", category: "Saúde & Bem-estar" },
  { value: "psicologia", label: "Psicologia", category: "Saúde & Bem-estar" },
  { value: "medicina", label: "Medicina", category: "Saúde & Bem-estar" },
  { value: "enfermagem", label: "Enfermagem", category: "Saúde & Bem-estar" },
  { value: "fisioterapia", label: "Fisioterapia", category: "Saúde & Bem-estar" },
  { value: "terapias-alternativas", label: "Terapias Alternativas", category: "Saúde & Bem-estar" },
  { value: "saude-mental", label: "Saúde Mental", category: "Saúde & Bem-estar" },
  { value: "saude-da-mulher", label: "Saúde da Mulher", category: "Saúde & Bem-estar" },
  { value: "saude-do-homem", label: "Saúde do Homem", category: "Saúde & Bem-estar" },
  { value: "prevencao-cuidados", label: "Prevenção & Cuidados", category: "Saúde & Bem-estar" },
  
  // Tecnologia & Inovação
  { value: "smartphones-gadgets", label: "Smartphones & Gadgets", category: "Tecnologia & Inovação" },
  { value: "inteligencia-artificial", label: "Inteligência Artificial", category: "Tecnologia & Inovação" },
  { value: "programacao-codigo", label: "Programação & Código", category: "Tecnologia & Inovação" },
  { value: "review-de-tecnologia", label: "Review de Tecnologia", category: "Tecnologia & Inovação" },
  { value: "dicas-de-apps", label: "Dicas de Apps", category: "Tecnologia & Inovação" },
  { value: "robotica", label: "Robótica", category: "Tecnologia & Inovação" },
  { value: "automacao", label: "Automação", category: "Tecnologia & Inovação" },
  { value: "internet-redes", label: "Internet & Redes", category: "Tecnologia & Inovação" },
  { value: "seguranca-digital", label: "Segurança Digital", category: "Tecnologia & Inovação" },
  { value: "web3-blockchain", label: "Web3 & Blockchain", category: "Tecnologia & Inovação" },
  
  // Turismo & Viagens
  { value: "viagens-nacionais", label: "Viagens Nacionais", category: "Turismo & Viagens" },
  { value: "viagens-internacionais", label: "Viagens Internacionais", category: "Turismo & Viagens" },
  { value: "mochilao", label: "Mochilão", category: "Turismo & Viagens" },
  { value: "roteiros-dicas", label: "Roteiros & Dicas", category: "Turismo & Viagens" },
  { value: "hospedagem", label: "Hospedagem", category: "Turismo & Viagens" },
  { value: "aviacao-milhas", label: "Aviação & Milhas", category: "Turismo & Viagens" },
  
  // Outros
  { value: "astrologia-signos", label: "Astrologia & Signos", category: "Outros" },
  { value: "tarot-esoterismo", label: "Tarot & Esoterismo", category: "Outros" },
  { value: "carros-de-luxo", label: "Carros de Luxo", category: "Outros" },
  { value: "realidade-virtual", label: "Realidade Virtual", category: "Outros" },
  { value: "drone-aeromodelismo", label: "Drone & Aeromodelismo", category: "Outros" },
  { value: "pesca-nautica", label: "Pesca & Náutica", category: "Outros" },
  { value: "camping-aventura", label: "Camping & Aventura", category: "Outros" },
  { value: "live-shopping", label: "Live Shopping", category: "Outros" },
];

export const getSubnichesByCategory = (): Record<string, Subniche[]> => {
  const grouped: Record<string, Subniche[]> = {};
  SUBNICHES.forEach((subniche) => {
    if (!grouped[subniche.category]) {
      grouped[subniche.category] = [];
    }
    grouped[subniche.category].push(subniche);
  });
  return grouped;
};

export const getSubnicheLabel = (value: string): string => {
  const subniche = SUBNICHES.find((s) => s.value === value);
  return subniche?.label || value;
};

export const getSubnicheCategory = (value: string): string => {
  const subniche = SUBNICHES.find((s) => s.value === value);
  return subniche?.category || "";
};

export const getSubnicheValueByLabel = (label: string): string => {
  // Remove a categoria entre parênteses se existir (ex: "Maquiagem (Beleza & Estética)" -> "Maquiagem")
  const cleanLabel = label.replace(/\s*\([^)]*\)\s*$/, "").trim();
  
  // Primeiro tenta encontrar pelo label limpo
  let subniche = SUBNICHES.find((s) => s.label === cleanLabel);
  
  // Se não encontrar, tenta encontrar pelo label completo
  if (!subniche) {
    subniche = SUBNICHES.find((s) => s.label === label);
  }
  
  // Se ainda não encontrar, tenta busca parcial (case insensitive)
  if (!subniche) {
    subniche = SUBNICHES.find((s) => 
      s.label.toLowerCase() === cleanLabel.toLowerCase() ||
      s.label.toLowerCase().includes(cleanLabel.toLowerCase())
    );
  }
  
  return subniche?.value || cleanLabel.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
};

