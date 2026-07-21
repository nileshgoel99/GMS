/** Step-by-step video guides (YouTube embeds). */

/** Preferred sidebar / mobile order — matches the live manufacturing workflow. */
export const GUIDE_CATEGORY_ORDER = [
  'Buyers',
  'Buyers PO',
  'Indents',
  'Suppliers',
  'Procurement',
];

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
    category: 'Buyers PO',
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
  {
    id: 'adding-suppliers',
    title: 'Adding Suppliers',
    category: 'Suppliers',
    description: 'Create supplier records with contact, address, and payment details for procurement.',
    embedUrl: 'https://www.youtube.com/embed/D5lqpJ2nY2I',
  },
  {
    id: 'supplier-po-trim',
    title: 'Creating a Supplier Purchase Order for a Trim',
    category: 'Procurement',
    description: 'Raise a trim Supplier PO from the library or indent lines, with quantities, rates, and terms.',
    embedUrl: 'https://www.youtube.com/embed/aL7nZbLOzAA',
  },
  {
    id: 'supplier-po-fabric',
    title: 'Creating a Fabric Supplier Purchase Order in FabriFlow',
    category: 'Procurement',
    description: 'Raise a fabric Supplier PO with material details, meters, rates, and terms.',
    embedUrl: 'https://www.youtube.com/embed/evOUwyX4_Ho',
  },
];

export const guideCategories = (guides = DOCUMENTATION_GUIDES) => {
  const present = new Set(guides.map((g) => g.category));
  const ordered = GUIDE_CATEGORY_ORDER.filter((c) => present.has(c));
  const extras = [...present].filter((c) => !GUIDE_CATEGORY_ORDER.includes(c));
  return [...ordered, ...extras];
};

export const guidesInCategoryOrder = (guides = DOCUMENTATION_GUIDES) => {
  const cats = guideCategories(guides);
  return cats.flatMap((category) => guides.filter((g) => g.category === category));
};
