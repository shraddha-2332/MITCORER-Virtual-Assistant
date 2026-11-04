import fs from 'node:fs';

const oldBase = 'https://mitcorer.edu.in/';
const newBase = 'https://mitcorer.edu.in/mitcorer/public/';

export const newWebsiteRouteMap = {
  // Main & About
  'https://mitcorer.edu.in/': 'https://mitcorer.edu.in/mitcorer/public/',
  'https://www.mitcorer.edu.in/': 'https://mitcorer.edu.in/mitcorer/public/',
  'https://mitcorer.edu.in/about-us.php': 'https://mitcorer.edu.in/mitcorer/public/about',
  'https://mitcorer.edu.in/faq.php': 'https://mitcorer.edu.in/mitcorer/public/admissions/faqs',
  'https://mitcorer.edu.in/contact-us.php': 'https://mitcorer.edu.in/mitcorer/public/contact-us',

  // Departments
  'https://mitcorer.edu.in/computer-science-engineering.php': 'https://mitcorer.edu.in/mitcorer/public/department/computer-science-engineering',
  'https://mitcorer.edu.in/civil-engineering.php': 'https://mitcorer.edu.in/mitcorer/public/department/civil-engineering',
  'https://mitcorer.edu.in/mechanical-engineering.php': 'https://mitcorer.edu.in/mitcorer/public/department/mechanical-rail-engineering',
  'https://mitcorer.edu.in/electronic-computer-engineering.php': 'https://mitcorer.edu.in/mitcorer/public/department/electronics-computer-engineering',
  'https://mitcorer.edu.in/about-professional-diploma-railway.php': 'https://mitcorer.edu.in/mitcorer/public/department/professional-diploma-railway',

  // Admissions & Fees
  'https://mitcorer.edu.in/fy-btech-fees.php': 'https://mitcorer.edu.in/mitcorer/public/admissions/fees-structure',
  'https://mitcorer.edu.in/d-sy-btech-fees.php': 'https://mitcorer.edu.in/mitcorer/public/admissions/dsy-fees-structure',
  'https://mitcorer.edu.in/fy-btech-documents.php': 'https://mitcorer.edu.in/mitcorer/public/admissions/documents',
  'https://mitcorer.edu.in/d-sy-btech-documents.php': 'https://mitcorer.edu.in/mitcorer/public/admissions/dsy-documents',
  'https://mitcorer.edu.in/fy-btech.php': 'https://mitcorer.edu.in/mitcorer/public/admissions',
  'https://mitcorer.edu.in/d-sy-btech.php': 'https://mitcorer.edu.in/mitcorer/public/admissions/dsy-overview',

  // Placements & Infrastructure
  'https://mitcorer.edu.in/placement-cell.php': 'https://mitcorer.edu.in/mitcorer/public/placements',
  'https://mitcorer.edu.in/our-recruiters.php': 'https://mitcorer.edu.in/mitcorer/public/placement/ourrecruiters',
  'https://mitcorer.edu.in/placement-record.php': 'https://mitcorer.edu.in/mitcorer/public/placement/record',
  'https://mitcorer.edu.in/mou.php': 'https://mitcorer.edu.in/mitcorer/public/placement/mous',
  'https://mitcorer.edu.in/hostel-amenities.php': 'https://mitcorer.edu.in/mitcorer/public/infrastructure/hostel-accommodations',
  'https://mitcorer.edu.in/bus.php': 'https://mitcorer.edu.in/mitcorer/public/infrastructure/bus',
  'https://mitcorer.edu.in/sports.php': 'https://mitcorer.edu.in/mitcorer/public/campus-life/sports',
  'https://mitcorer.edu.in/technical-events-rail-mit.php': 'https://mitcorer.edu.in/mitcorer/public/campus-life/technical-events',
  'https://mitcorer.edu.in/nss.php': 'https://mitcorer.edu.in/mitcorer/public/campus-life/nss',
};

