import React from 'react';

import { decodeB64 } from '../../../util/encoding'

import PageMetadata from './pageMetadata';
import ImagePicker from './imagePicker';
import PageSettings from './configs/pageSettings';
import Prosemirror from './prosemirror';

import documentStrategy from '../../../util/documentStrategy';
import {
  formatDraftBranchName,
  pathHasDraft,
  getDraft } from '../../../util/branchFormatter';

import alertActions from '../../../actions/alertActions';
import siteActions from '../../../actions/siteActions';
import { pushHistory, replaceHistory } from '../../../actions/routeActions';

const propTypes = {
  site: React.PropTypes.shape({
    assets: React.PropTypes.array,
    branch: React.PropTypes.string,
    branches: React.PropTypes.array,
    '_config.yml': React.PropTypes.object,
    defaultBranch: React.PropTypes.string,
    files: React.PropTypes.array,
    id: React.PropTypes.number,
    owner: React.PropTypes.string,
    repository: React.PropTypes.string
  })
};

const redirectToFileOnBranch = (siteId, branch, filePath) => {
  replaceHistory(`/sites/${siteId}/edit/${branch}/${filePath}`);
};

const alertAndRedirect = (message, uri) => {
  alertActions.alertSuccess(message);
  pushHistory(uri);
};

let insertFn;

class Editor extends React.Component {
  constructor(props) {
    super(props);

    this.state = Object.assign({}, {
      imagePicker: false,
    }, this.getStateWithProps(props));

    this.commitOrPR = this.commitOrPR.bind(this);
    this.submitFile = this.submitFile.bind(this);
    this.submitDraft = this.submitDraft.bind(this);
    this.deleteDraft = this.deleteDraft.bind(this);
    this.handleChange = this.handleChange.bind(this);
    this.onOpenImagePicker = this.onOpenImagePicker.bind(this);
    this.onCloseImagePicker = this.onCloseImagePicker.bind(this);
    this.onConfirmInsertImage = this.onConfirmInsertImage.bind(this);
    this.onUpload = this.onUpload.bind(this);
  }

  componentDidMount() {
    // Bail if we are on a new page; there wont be any drafts
    if (this.props.route.isNewPage) {
      return;
    }

    // trigger the fetch file content action for the case
    // when a user first loads this view. That could be
    // a changing of the route to a site for the first time
    // or directly loading the url
    const { branch: currentBranch } = this.props.params;
    const { site } = this.props;
    const branches = site.branches || [];
    const draftBranchName = formatDraftBranchName(this.path);
    const hasDraft = pathHasDraft(this.path, branches);
    const draftBranchIsNotCurrent = (draftBranchName !== currentBranch);
    let nextSite = site;

    if (hasDraft) {
      nextSite = Object.assign({}, site, {
        branch: draftBranchName
      });
    }

    siteActions.fetchFileContent(nextSite, this.path).then(() => {
      if (hasDraft) {
        if (draftBranchIsNotCurrent) {
          redirectToFileOnBranch(nextSite.id, draftBranchName, this.path);
        }
      } else {
        // currently this always redirects
        redirectToFileOnBranch(nextSite.id, nextSite.defaultBranch, this.path);
      }
    });
  }

  componentWillReceiveProps(nextProps) {
    const nextState = this.getStateWithProps(nextProps);
    this.setState(nextState);
  }

  registerInsertImageFn(fn) {
    insertFn = fn;
  }

  onOpenImagePicker() {
    this.setState({
      imagePicker: true
    });
  }

  onCloseImagePicker() {
    this.setState({
      imagePicker: false
    });
  }

  onConfirmInsertImage(fileName) {
    const asset = this.props.site.assets.find((asset) => asset.path === fileName);
    insertFn(asset);
  }

  getStateWithProps(props) {
    const file = this.getCurrentFile(props) || {};
    const { frontmatter, markdown, raw, path } = documentStrategy(file);

    return {
      encoded: raw || false,
      frontmatter,
      markdown,
      path: path || '',
      raw: raw,
      sha: file.sha || false
    };
  }

  buildFile() {
    let { frontmatter, markdown, path, message } = this.state;
    let content = markdown;

    if (!path) {
      return alertActions.alertError('File must have a name');
    }

    if (!message) {
      message = this.getComputedMessage();
    }

    if (frontmatter) {
      content = `---\n${frontmatter}\n---\n${markdown}`;
    } else if (frontmatter && !markdown) {
      content = frontmatter;
    }

    if (this.props.route.isNewPage) {
      path = `pages/${path}.md`;
    }

    return { content, path, message };
  }

  openPRWithHead(branchName, site) {
    return this.submitFile(branchName).then(() => {
      return siteActions.createPR(site, branchName, site.defaultBranch);
    }).then(() => {
      pushHistory(`/sites/${site.id}`);
    });
  }

  commitOrPR() {
    const { site } = this.props;
    const { path } = this.state;
    const draftBranch = getDraft(path, site.branches);

    if (!draftBranch) {
      // Just commit the edited file
      return this.submitFile();
    }

    // All federalist draft branch PRs are opened against master
    this.openPRWithHead(draftBranch.name, site);
  }

  submitFile(branch = this.props.site.defaultBranch) {
    const { site } = this.props;
    const { sha } = this.state;
    const {content, path, message} = this.buildFile();
    const nextSite = Object.assign({}, site, {
      branch
    });

    return siteActions.createCommit(nextSite, path, content, message, sha);
  }

  submitDraft() {
    const { site } = this.props;
    const { path } = this.state;
    const draftBranch = getDraft(path, site.branches);

    if (draftBranch) {
      this.submitFile(draftBranch.name);
    } else {
      siteActions.createDraftBranch(site, path).then((branchName) => {
        return this.submitFile(branchName);
      }).then(() => {
        const branch = formatDraftBranchName(path);
        redirectToFileOnBranch(site.id, branch, path);
      });
    }
  }

  deleteDraft() {
    const { site } = this.props;
    const { path } = this.state;

    siteActions.deleteBranch(site, formatDraftBranchName(path)).then(() => {
      alertAndRedirect('Draft successfully deleted', `/sites/${site.id}`);
    });
  }

  handleChange(name, value) {
    const nextState = {};
    nextState[name] = value;
    this.setState(nextState);
  }

  getCurrentFile(props) {
    const files = props.site.files || [];

    return files.find((file) => {
      return file.path === this.path;
    }) || {};
  }

  get path() {
    const params = this.props.params;

    if (params.splat) {
      return `${params.splat}/${params.fileName}`;
    }

    return params.fileName;
  }

  getComputedMessage() {
    const newPage = this.props.route.isNewPage;
    const hasMessage = this.state.message || this.state.message === '';
    if (hasMessage) return this.state.message;
    if (newPage) return `New page added at ${this.state.path}`;
    return `Changes made to ${this.state.path}`;
  }

  getNewPage() {
    const newPage = this.props.route.isNewPage;

    return !newPage ? null : (
      <PageMetadata
        path={this.state.path}
        handleChange={this.handleChange}/>
    );
  }

  getImagePicker() {
    return !this.state.imagePicker ? null :
      <ImagePicker
        handleConfirm={this.onConfirmInsertImage}
        handleUpload={this.onUpload}
        handleCancel={this.onCloseImagePicker}
        assets={this.props.site.assets}
      />;
  }

  getAssetPath() {
    const { site } = this.props;

    return [
      'https://raw.githubusercontent.com',
      site.owner,
      site.repository,
      site.branch || site.defaultBranch,
      ''
    ].join('/');
  }

  onUpload(file) {
    const { site } = this.props;
    const existingUpload =  site.assets.find(asset => asset.name === file.name);

    let uploadOptions = [site, file];

    if (existingUpload) {
      uploadOptions.push(existingUpload.sha);
    }

    siteActions.uploadFile.apply(siteActions, uploadOptions);
  }

  // TODO: break up this component. We need an intermediate form component that
  // handles submission of the form content. This container should just render
  // the form and the image picker, and probably call actions after content has
  // been verified.
  render() {
    const { props, state } = this;
    const { frontmatter, markdown } = state;

    return (
      <div>
        {this.getImagePicker()}
        {this.getNewPage()}

        <PageSettings
          templateConfig={ props.site['_config.yml'] && props.site['_config.yml'].content }
          frontmatter={ frontmatter }
          onChange={ (frontmatter) => {
            this.handleChange('frontmatter', frontmatter);
          }} />
        <Prosemirror
          initialMarkdownContent={ markdown }
          assetPath={this.getAssetPath()}
          onChange={ (markdown) => {
            this.handleChange('markdown', markdown);
          }}
          handleToggleImages={this.onOpenImagePicker}
          registerInsertImage={this.registerInsertImageFn}
        />
        <div className="usa-alert usa-alert-info">
          <div className="usa-alert-body">
            <h3 className="usa-alert-heading"></h3>
            <p className="usa-alert-text">Make this a helpful save message for yourself and future collaborators.</p>
            <input type="text" name="message"
              value={ this.getComputedMessage() }
              onChange={ (event) => {
                this.handleChange('message', event.target.value);
              }}
            />
            <button
              className="usa-button-outline"
              onClick={this.submitDraft}
            >Save as Draft</button>
            <button
              className="usa-button-outline"
              onClick={this.deleteDraft}
            >Delete Draft</button>

            <button onClick={this.commitOrPR}>Save &amp; Publish</button>
          </div>
        </div>
      </div>
    );
  }
}

Editor.propTypes = propTypes;

export default Editor;
