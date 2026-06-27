"""Permission module definitions for GMS."""

ALL_MODULES = [
    ('dashboard', 'Plant dashboard'),
    ('customers', 'Buyers'),
    ('buyer_pos', 'Buyer POs'),
    ('pi', 'Proforma invoices'),
    ('indents', 'Indents'),
    ('trims', 'Trims library'),
    ('suppliers', 'Suppliers'),
    ('inventory', 'Inventory / stock'),
    ('sales', 'Sales entry (incoming payments)'),
    ('purchase_bills', 'Purchase bills (outgoing payments)'),
    ('supplier_po', 'Supplier POs'),
    ('production', 'Production'),
    ('company', 'Company details'),
    ('users', 'Users & roles'),
]

MODULE_KEYS = [m[0] for m in ALL_MODULES]

DEFAULT_ROLES = [
    {
        'code': 'ADMIN',
        'name': 'Admin',
        'description': 'Full access to all modules',
        'is_admin': True,
        'is_system': True,
        'modules': [],
    },
    {
        'code': 'MANAGER',
        'name': 'Manager',
        'description': 'Indents and stock (inventory)',
        'is_admin': False,
        'is_system': True,
        'modules': ['dashboard', 'indents', 'inventory'],
    },
    {
        'code': 'MERCHANDISER',
        'name': 'Merchandiser',
        'description': 'Buyer POs, PIs, and indents',
        'is_admin': False,
        'is_system': True,
        'modules': ['dashboard', 'customers', 'buyer_pos', 'pi', 'indents', 'trims'],
    },
    {
        'code': 'ACCOUNTS',
        'name': 'Accounts',
        'description': 'Sales (incoming) and purchase bills (outgoing)',
        'is_admin': False,
        'is_system': True,
        'modules': ['dashboard', 'sales', 'purchase_bills'],
    },
    {
        'code': 'PURCHASING',
        'name': 'Purchasing',
        'description': 'Indents and supplier POs',
        'is_admin': False,
        'is_system': True,
        'modules': ['dashboard', 'indents', 'supplier_po', 'suppliers', 'trims'],
    },
]
