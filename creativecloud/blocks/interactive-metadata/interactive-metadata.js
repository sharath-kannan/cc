import { getLibs } from '../../scripts/utils.js';

function getNextStepIndex(stepInfo) {
  return (stepInfo.stepIndex + 1) % stepInfo.stepCount;
}

function getPrevStepIndex(stepInfo) {
  return stepInfo.stepIndex - 1 >= 0
    ? stepInfo.stepIndex - 1
    : stepInfo.stepList.length - 1;
}

async function handleNextStep(stepInfo) {
  const eagerLoad = (lcpImg) => {
    lcpImg?.setAttribute('loading', 'eager');
    lcpImg?.setAttribute('fetchpriority', 'high');
  };
  const nextStepIndex = getNextStepIndex(stepInfo);
  const nextImgs = stepInfo.stepConfigs[nextStepIndex].querySelectorAll('img');
  [...nextImgs].forEach(eagerLoad);
  stepInfo.stepInit = await loadJSandCSS(stepInfo.stepList[nextStepIndex]);
}

function handleImageTransition(stepInfo) {
  const stepPic = stepInfo.stepConfigs[stepInfo.stepIndex].querySelector('picture');
  const hasStepPic = !stepPic.querySelector('img').src.includes('.svg');
  if (!hasStepPic) return;
  const stepPicClone = stepPic.cloneNode(true);
  stepPic.insertAdjacentElement('afterEnd', stepPicClone);
  stepInfo.target.querySelector('picture').replaceWith(stepPic);
}

function handleLCPImage(stepInfo) {
  if (stepInfo.stepIndex !== 0) return;
  const pic = stepInfo.target.querySelector('picture');
  const picClone = pic.cloneNode(true);
  stepInfo.stepConfigs[0].querySelector(':scope > div').prepend(picClone);
}

async function handleLayerDisplay(stepInfo) {
  handleImageTransition(stepInfo);
  const currLayer = stepInfo.target.querySelector(`.layer-${stepInfo.stepIndex}`);
  const prevStepIndex = getPrevStepIndex(stepInfo);
  const prevLayer = stepInfo.target.querySelector(`.layer-${prevStepIndex}`);
  prevLayer?.classList.remove('show-layer');
  stepInfo.target.classList.remove(`step-${stepInfo.stepList[prevStepIndex]}`);
  stepInfo.target.classList.add(`step-${stepInfo.stepName}`);
  const miloLibs = getLibs('/libs');
  const { decorateDefaultLinkAnalytics } = await import(`${miloLibs}/martech/attributes.js`);
  await decorateDefaultLinkAnalytics(currLayer);
  currLayer.classList.add('show-layer');
}

async function loadJSandCSS(stepName) {
  const miloLibs = getLibs('/libs');
  const { loadStyle } = await import(`${miloLibs}/utils/utils.js`);
  const stepJS = `${window.location.origin}/creativecloud/features/interactive-components/${stepName}/${stepName}.js`;
  const stepCSS = `${window.location.origin}/creativecloud/features/interactive-components/${stepName}/${stepName}.css`;
  loadStyle(stepCSS);
  const { default: initFunc } = await import(stepJS);
  return initFunc;
}

async function implementWorkflow(el, stepInfo) {
  const currLayer = stepInfo.target.querySelector(`.layer-${stepInfo.stepIndex}`);
  if (currLayer) {
    await handleLayerDisplay(stepInfo);
    await handleNextStep(stepInfo);
    return;
  }
  await stepInfo.stepInit(stepInfo);
  const layerName = `.layer-${stepInfo.stepIndex}`;
  handleLCPImage(stepInfo);
  await handleLayerDisplay(stepInfo);
  await handleNextStep(stepInfo);
}

function getTargetArea(el) {
  const metadataSec = el.closest('.section');
  const previousSection = metadataSec.previousElementSibling;
  const tmb = previousSection.querySelector('.marquee, .aside');
  tmb?.classList.add('interactive-enabled');
  return tmb.querySelector('.asset');
}

function getWorkFlowInformation(el) {
  let wfName = '';
  const intWorkFlowConfig = {
    'workflow-1': ['generate', 'selector-tray', 'crop', 'start-over'],
    'workflow-2': ['crop', 'crop', 'start-over']
  };
  const wfNames = Object.keys(intWorkFlowConfig);
  const stepList = [];
  [...el.classList].forEach((cn) => {
    if (cn.match('workflow-')) {
      wfName = cn;
      return;
    }
    if (cn.match('step-')) {
      stepList.push(cn.split('-')[1]);
    }
  });

  if(wfName === 'workflow-genfill') {
    const genArr = new Array(el.childElementCount - 1).fill('generate');
    genArr.push('start-over');
    return genArr;
  }
  if (wfNames.includes(wfName)) return intWorkFlowConfig[wfName];
  if (stepList.length) return stepList;
  return [];
}

async function addBtnAnimation(ia) {
  const miloLibs = getLibs('/libs');
  const { createTag } = await import(`${miloLibs}/utils/utils.js`);
  const btns = ia.querySelectorAll('.layer .gray-button');
  [...btns].forEach(btn => {
    const circle = createTag('div', { class: 'ia-circle' });
    btn.append(circle);
    circle.style.animation = 'circle-in 500ms ease-out 500ms, circle-out 400ms ease-out 800ms';
    btn.style.animation = 'outline 800ms ease-out 500ms, fill-in 1500ms ease-in-out 800ms';
  });
}

function addAnimationToLayer(ia) {
  if (ia.querySelector('.layer .gray-button')) addBtnAnimation(ia);
}

async function renderLayer(stepInfo) {
  let pResolve = null;
  stepInfo.openForExecution = new Promise( function(resolve, reject) { pResolve = resolve });
  stepInfo.stepIndex = getNextStepIndex(stepInfo);
  stepInfo.stepName = stepInfo.stepList[stepInfo.stepIndex];
  await implementWorkflow(stepInfo.el, stepInfo);
  pResolve();
}

export default async function init(el) {
  const workflow = getWorkFlowInformation(el);
  if (!workflow.length) return;
  const targetAsset = getTargetArea(el);
  if (!targetAsset) return;
  const stepInit = await loadJSandCSS(workflow[0]);
  const stepInfo = {
    el,
    stepIndex: -1,
    stepName: workflow[0],
    stepList: workflow,
    stepCount: workflow.length,
    stepConfigs: el.querySelectorAll(':scope > div'),
    handleImageTransition,
    nextStepEvent: 'cc:interactive-switch',
    stepInit,
    target: targetAsset,
    openForExecution: true,
  };
  await renderLayer(stepInfo);
  addAnimationToLayer(targetAsset);
  el.addEventListener('cc:interactive-switch', async (e) => {
    await renderLayer(stepInfo);
  });
}