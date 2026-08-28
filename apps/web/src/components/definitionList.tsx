import {
  AdminDefinitionDetails,
  AdminDefinitionList,
  AdminDefinitionTerm,
} from "./admin/adminUtility.stylex";

const DefinitionList = Object.assign(AdminDefinitionList, {
  Details: AdminDefinitionDetails,
  Term: AdminDefinitionTerm,
});

export default DefinitionList;
