/** Step-by-step video guides (ScribeHow embeds). */

export const DOCUMENTATION_GUIDES = [
  {
    id: 'create-customer',
    title: 'How to Create a New Customer in Fabricon',
    category: 'Buyers',
    description: 'Add a new buyer to the system with contact and billing details.',
    embedUrl:
      'https://scribehow.com/embed/How_To_Create_A_New_Customer_In_GMS__IN-kWJq8TzCN5_7Gi-u1Ow?as=video',
  },
  {
    id: 'edit-customer',
    title: 'How to View and Edit Customer Details',
    category: 'Buyers',
    description: 'Find an existing buyer and update their profile information.',
    embedUrl:
      'https://scribehow.com/embed/How_To_View_and_Edit_A_Customer_Details__jJpdgyfBSBG1kG4_NXl7UQ?as=video',
  },
  {
    id: 'create-buyer-po',
    title: 'How to Create a New Buyer Purchase Order',
    category: 'Buyer POs',
    description: 'Create a buyer PO linked to styles, quantities, and commercial terms.',
    embedUrl:
      'https://scribehow.com/embed/How_to_Create_a_New_Buyer_Purchase_Order__bKd6HaMLRpODYbz9S5NuyA?as=video',
  },
];

export const guideCategories = (guides) =>
  [...new Set(guides.map((g) => g.category))];
