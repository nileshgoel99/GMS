/** Step-by-step video guides (YouTube embeds). */

export const DOCUMENTATION_GUIDES = [
  {
    id: 'create-customers',
    title: 'How to Create Customers',
    category: 'Buyers',
    description: 'Add new buyers to FabriFlow with contact and billing details.',
    embedUrl: 'https://www.youtube.com/embed/OwJm9qiObxY',
  },
  {
    id: 'buyer-po-and-pi',
    title: 'Creating Buyer Purchase Orders & Proforma Invoices',
    category: 'Buyer POs',
    description: 'Create buyer POs and raise proforma invoices from the commercial workflow.',
    embedUrl: 'https://www.youtube.com/embed/830VL8D_u2I',
  },
  {
    id: 'indent-trims-accessories',
    title: 'Adding Trims & Accessories In Indent',
    category: 'Indents',
    description: 'Add trims and accessories to a production indent from the library or PI lines.',
    embedUrl: 'https://www.youtube.com/embed/t3cSbmZYX3Y',
  },
];

export const guideCategories = (guides) =>
  [...new Set(guides.map((g) => g.category))];
