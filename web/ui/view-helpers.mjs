import { today } from '../../shared/domain.mjs';
import { $ } from './dom.mjs';
import { session } from './session.mjs';

export const selectedMonth = () => $('selectedMonth').value || today().slice(0, 7);
// Numărul de contract este identificatorul folosit în discuția cu părintele.
export const contractOf = c => c.contractNumber || c.id;
export const groupName = id => session.state.groups.find(g => g.id === id)?.name || '';
