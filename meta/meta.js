import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

async function loadData() {
    const data = await d3.csv('loc.csv', (row) => ({
      ...row,
      line: Number(row.line), // or just +row.line
      depth: Number(row.depth),
      length: Number(row.length),
      date: new Date(row.date + 'T00:00' + row.timezone),
      datetime: new Date(row.datetime),
    }));
  
    return data;
  }
  


function processCommits(data) {
    return d3
      .groups(data, (d) => d.commit)
      .map(([commit, lines]) => {
        let first = lines[0];
        let { author, date, time, timezone, datetime } = first;
        let ret = {
          id: commit,
          url: 'https://github.com/vis-society/lab-7/commit/' + commit,
          author,
          date,
          time,
          timezone,
          datetime,
          hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
          totalLines: lines.length,
        };
  
        Object.defineProperty(ret, 'lines', {
          value: lines,
          configurable: false,
          writable: false,
          enumerable: false,
        });
  
        return ret;
      });
  }
  



function renderCommitInfo(data, commits) {
    // Create the dl element
    const dl = d3.select('#stats').append('dl').attr('class', 'stats');
  
    // Add total LOC
    dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
    dl.append('dd').text(data.length);
  
    // Add total commits
    dl.append('dt').text('Total commits');
    dl.append('dd').text(commits.length);
  
    // Add more stats as needed...
    // Number of files
    const numFiles = d3.group(data, d => d.file).size;

    dl.append('dt').text('Files');
    dl.append('dd').text(numFiles);

    // longest line
    const longestLine = d3.max(data, d => +d.length)

    dl.append('dt').text('Longest Line')
    dl.append('dd').text(longestLine);

    // average line length
    const avgLineLength = d3.mean(data, d => +d.length);

    dl.append('dt').text('Average line length');
    dl.append('dd').text(avgLineLength.toFixed(1));

  }

let xScale, yScale;
function renderScatterPlot(data, commits) {

    const sortedCommits = d3.sort(commits, (d) => -d.totalLines);
    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3
        .scaleSqrt() // Change only this line
        .domain([minLines, maxLines])
        .range([2, 30]);
    const width = 1000;
    const height = 600;

    const svg = d3
        .select('#chart')
        .append('svg')
        .attr('viewBox', `0 0 ${width} ${height}`)
        .style('overflow', 'visible');

    xScale = d3
        .scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([0, width])
        .nice();
      
    yScale = d3.scaleLinear().domain([0, 24]).range([height, 0]);
    
    const dots = svg.append('g').attr('class', 'dots');



    dots
        .selectAll('circle')
        .data(sortedCommits, (d) => d.id) // change this line
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', (d) => rScale(d.totalLines))
        .style('fill-opacity', 0.7)
        .attr('fill', 'steelblue')
        .on('mouseenter', (event, commit) => {
            d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
            renderTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);

        })
        .on('mouseleave', (event) => {
            d3.select(event.currentTarget).style('fill-opacity', 0.7);
            updateTooltipVisibility(false);
        
        });
        
    const margin = { top: 10, right: 10, bottom: 30, left: 20 };

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    xScale.range([usableArea.left, usableArea.right]);
    yScale.range([usableArea.bottom, usableArea.top]);


    // Add gridlines BEFORE the axes
    const gridlines = svg
    .append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`);

    // Create gridlines as an axis with no labels and full-width ticks
    gridlines.call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));
    
    // Create the axes
    const xAxis = d3.axisBottom(xScale);
    const yAxis = d3
        .axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    // Add X axis
    svg
    .append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .attr('class', 'x-axis') // new line to mark the g tag
    .call(xAxis);

    // Add Y axis
    svg
    .append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .attr('class', 'y-axis') // just for consistency
    .call(yAxis);

    svg.call(d3.brush().on('start brush end', brushed));
    svg.selectAll('.dots, .overlay ~ *').raise();
    
    }
  
let data = await loadData();
let commits = processCommits(data);
    
let commitProgress = 100;

let timeScale = d3
  .scaleTime()
  .domain([
    d3.min(commits, (d) => d.datetime),
    d3.max(commits, (d) => d.datetime),
  ])
  .range([0, 100]);
let commitMaxTime = timeScale.invert(commitProgress);

const timeSlider = document.getElementById('commit-progress');
const timeDisplay = document.getElementById('commit-slider-time');


let filteredCommits = commits;
let colors = d3.scaleOrdinal(d3.schemeTableau10);



function updateFileDisplay(filteredCommits){
  let lines = filteredCommits.flatMap((d) => d.lines);
  let files = d3
  .groups(lines, (d) => d.file)
  .map(([name, lines]) => {
    return { name, lines };
  })
  .sort((a, b) => b.lines.length - a.lines.length);


  let filesContainer = d3
  .select('#files')
  .selectAll('div')
  .data(files, (d) => d.name)
  .join(
    // This code only runs when the div is initially rendered
    (enter) =>
      enter.append('div').call((div) => {
        div.append('dt').append('code');
        div.append('dd');
      }),

    (update) => update,
    (exit) => exit.remove()
  );

  // This code updates the div info
  filesContainer
  .select('dt')
  .html(
    (d) => `
      <code>${d.name}</code>
      <small>${d.lines.length} lines</small>
    `
  );


  filesContainer
  .select('dd')
  .selectAll('div')
  .data((d) => d.lines)
  .join('div')
  .attr('class', 'loc')
  .attr('style', (d) => `--color: ${colors(d.type)}`);
}

function updateScatterPlot(data, filteredData) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 20 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };

  const svg = d3.select('#chart').select('svg');

  xScale = xScale.domain(d3.extent(filteredData, (d) => d.datetime));

  const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
  const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 30]);

  const xAxis = d3.axisBottom(xScale);

  const xAxisGroup = svg.select('g.x-axis');
  xAxisGroup.selectAll('*').remove();
  xAxisGroup.call(xAxis);

  const dots = svg.select('g.dots');

  const sortedCommits = d3.sort(filteredData, (d) => -d.totalLines);
  dots
    .selectAll('circle')
    .data(sortedCommits, (d) => d.id) // change this line
    .join('circle')
    .attr('cx', (d) => xScale(d.datetime))
    .attr('cy', (d) => yScale(d.hourFrac))
    .attr('r', (d) => rScale(d.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7) // Add transparency for overlapping dots
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1); // Full opacity on hover
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });
}

function onTimeSliderChange() {
  // Update progress from slider
  commitProgress = +timeSlider.value;

  // Convert slider percentage to actual date
  commitMaxTime = timeScale.invert(commitProgress);

  // Display formatted date/time
  timeDisplay.textContent = commitMaxTime.toLocaleString();

  filteredCommits = commits.filter((d) => d.datetime <= commitMaxTime);

  updateScatterPlot(data, filteredCommits);

  updateFileDisplay(filteredCommits);

  d3.select('#stats').html('');
  const filteredLines = filteredCommits.flatMap(d => d.lines);
  renderCommitInfo(filteredLines, filteredCommits); 
}


timeSlider.addEventListener('input', onTimeSliderChange);

renderCommitInfo(data, commits);
renderScatterPlot(data, commits);

onTimeSliderChange();




function renderTooltipContent(commit) {
    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
    const time = document.getElementById('commit-time');
    const author = document.getElementById('commit-author');
    const lines = document.getElementById('commit-lines');
    
    if (Object.keys(commit).length === 0) return;
  
    link.href = commit.url;
    link.textContent = commit.id;
    date.textContent = commit.datetime?.toLocaleString('en', {
      dateStyle: 'full',
    });

    time.textContent = commit.datetime?.toLocaleString('en', {
        timeStyle: 'short',
    });

    author.textContent = commit.author;
    lines.textContent = commit.totalLines;
    
  }

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
  }

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX}px`;
    tooltip.style.top = `${event.clientY}px`;
  }


function brushed(event) {
    console.log(event);
    const selection = event.selection;
    d3.selectAll('circle').classed('selected', (d) =>
        isCommitSelected(selection, d),
      );
    renderSelectionCount(selection);
    renderLanguageBreakdown(selection);
    function renderSelectionCount(selection) {
        const selectedCommits = selection
          ? commits.filter((d) => isCommitSelected(selection, d))
          : [];
      
        const countElement = document.querySelector('#selection-count');
        countElement.textContent = `${
          selectedCommits.length || 'No'
        } commits selected`;
      
        return selectedCommits;
      }
    
    function renderLanguageBreakdown(selection) {
        const selectedCommits = selection
          ? commits.filter((d) => isCommitSelected(selection, d))
          : [];
        const container = document.getElementById('language-breakdown');
      
        if (selectedCommits.length === 0) {
          container.innerHTML = '';
          return;
        }
        const requiredCommits = selectedCommits.length ? selectedCommits : commits;
        const lines = requiredCommits.flatMap((d) => d.lines);
      
        // Use d3.rollup to count lines per language
        const breakdown = d3.rollup(
          lines,
          (v) => v.length,
          (d) => d.type,
        );
      
        // Update DOM with breakdown
        container.innerHTML = '';
      
        for (const [language, count] of breakdown) {
          const proportion = count / lines.length;
          const formatted = d3.format('.1~%')(proportion);
      
          container.innerHTML += `
                  <dt>${language}</dt>
                  <dd>${count} lines (${formatted})</dd>
              `;
        }
      }
  }


function isCommitSelected(selection, commit) {
    if (!selection) {
      return false;
    }
    
    const [[x0, y0], [x1, y1]] = selection;

    const x = xScale(commit.datetime);
    const y = yScale(commit.hourFrac);

    return x >= x0 && x <= x1 && y >= y0 && y <= y1;
  }



d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html(
    (d, i) => `
		On ${d.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
		I made <a href="${d.url}" target="_blank">${
      i > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
		I edited ${d.totalLines} lines across ${
      d3.rollups(
        d.lines,
        (D) => D.length,
        (d) => d.file,
      ).length
    } files.
		Then I looked over all I had made, and I saw that it was very good.
	`,
  );


  let lastCommitTime = null;

  function onStepEnter(response) {
    const commit = response.element.__data__;
  
    if (lastCommitTime === commit.datetime) return;
    lastCommitTime = commit.datetime;
  
    filteredCommits = commits.filter(d => d.datetime <= commit.datetime);
  
    updateScatterPlot(data, filteredCommits);
    updateFileDisplay(filteredCommits);
  
    d3.select('#stats').html('');
    const filteredLines = filteredCommits.flatMap(d => d.lines);
    renderCommitInfo(filteredLines, filteredCommits);
  }

const scroller = scrollama();
scroller
    .setup({
      container: '#scrolly-1',
      step: '#scrolly-1 .step',
    })
    .onStepEnter(onStepEnter);

