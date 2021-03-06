import React from 'react';
import PageListItem from './pageListItem';

import { pathHasDraft } from '../../../util/branchFormatter';

const propTypes = {
  site: React.PropTypes.object.isRequired
};

const NavigationJsonContent = ({ site }) => {
  const pagesConfiguration = site['_navigation.json'];
  const { id, defaultBranch, branches = [] } = site;

  return (
    <ul className="list-group">
      { emitPages(pagesConfiguration, id, defaultBranch, branches) }
    </ul>
  );
};

const emitPages = (pages, siteId, defaultBranch, branches) => {
  const emitPage = (page, index) => {
    const { title, permalink, href, children } = page;
    const pageListItemHref = getLinkFor(href, siteId, defaultBranch);

    return (
      <PageListItem
        key={ index }
        pageName={ title }
        href={ pageListItemHref }
        isPageDirectory={ false }
        hasDraft={ pathHasDraft(href, branches) }
      >
        { emitChildren(children, siteId, defaultBranch, branches) }
      </PageListItem>
    );
  };

  return pages.map(emitPage);
};

const getLinkFor = (href, siteId, defaultBranch) => {
  return `/sites/${siteId}/edit/${defaultBranch}/${href}`;
};

const emitChildren = (children, siteId, defaultBranch, branches) => {
  if (children) {
    return (
      <ul className="list-group">
        { emitPages(children, siteId, defaultBranch, branches) }
      </ul>
    );
  }
};

NavigationJsonContent.propTypes = propTypes;

export default NavigationJsonContent;
