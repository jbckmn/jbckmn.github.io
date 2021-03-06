var width = document.body.clientWidth - 60,
    height = Math.min(width - 200, window.innerHeight) - 200,
    loading = document.getElementById('loading'),
    svg = dimple.newSvg('#chartContainer', width, height),
    name = window.prompt('What\'s the password?', ''),
    queryDate = window.location.href.split('today=')[1],
    today = new Date(queryDate || (new Date())),
    todayStart = new Date(today.toJSON().substring(0, 10)),
    month = today.getMonth(),
    year = today.getFullYear(),
    DAYLENGTH = 1000 * 60 * 60 * 24,
    past = new Date(today.getTime() - (DAYLENGTH * 30)),
    future = new Date(today.getTime() + (DAYLENGTH * 30)),
    domain = 'https://' + name + '.threadmeup.com';

todayStart = new Date(todayStart.getTime() +
    (todayStart.getTimezoneOffset() * 60 * 1000));

function drawData(data) {
    var myChart = new dimple.chart(svg, data),
        myLegend,
        filterValues,
        x, y,
        s;

    loading.innerHTML = '';
    myChart.setBounds(60, 30, width - 100, height - 100);
    x = myChart.addTimeAxis('x', 'date', '%Y-%m-%d', '%Y/%m/%d');
    x.addOrderRule('Date');
    x.ticks = 10;
    y = myChart.addMeasureAxis('y', 'quantity');
    s = myChart.addSeries('category', dimple.plot.line);
    //s.interpolation = 'cardinal';
    s.lineMarkers = true;
    myLegend = myChart.addLegend(60, 10, width - 100, 20, 'right');
    myChart.draw();
    //markWeekends();
    myChart.legends = [];
    svg.selectAll("title_text")
        .data(["Click legend to","show/hide category:"])
        .enter()
        .append("text")
        .attr("x", 100)
        .attr("y", function (d, i) { return 10 + i * 10; })
        .style('font-family', 'sans-serif')
        .style('font-size', '10px')
        .style('color', 'black')
        .text(function (d) { return d; });
    svg.append("line")
        .attr("x1", x._scale(todayStart))
        .attr("x2", x._scale(todayStart))
        .attr("y1", y._scale.range()[0])
        .attr("y2", y._scale.range()[1])
        .style('stroke', '#d3d3d3');
    svg.append("text")
        .attr("x", x._scale(todayStart) + 1)
        .attr("y", y._scale.range()[1] - 2)
        .text(queryDate ? queryDate : 'Today')
        .style('font-size', '10px')
        .style('font-family', 'sans-serif');

    filterValues = dimple.getUniqueValues(data, 'category');
    myLegend.shapes.selectAll('rect')
        .on('click', function(e) {
            var hide = false,
                newFilters = [];

            filterValues.forEach(function(f) {
                if (f === e.aggField.slice(-1)[0]) {
                    hide = true;
                } else {
                    newFilters.push(f);
                }
            });
            if (hide) {
                d3.select(this).style('opacity', 0.2);
            } else {
                newFilters.push(e.aggField.slice(-1)[0]);
                d3.select(this).style('opacity', 0.8);
            }

            filterValues = newFilters;
            myChart.data = dimple.filterData(data, 'category', filterValues);
            myChart.draw(800);
        });

    function markWeekends() {
        var t = new Date(past.toJSON().slice(0, 10)),
            d;

        while (t < future) {
            d = t.getUTCDay();
            if (d == 6) {
                svg.append("rect")
                    .attr("x", x._scale(t))
                    .attr("width", Math.abs(x._scale(t) - x._scale(new Date(t.setUTCDate(t.getUTCDate() + 2)))))
                    .attr("height", y._scale.range()[0])
                    .attr("y", y._scale.range()[1])
                    .style('fill', 'rgba(0,0,0,0.1)');
            }
            t = new Date(t.getTime() + DAYLENGTH);
        }
    }
}

(function getMovements() {
    var d = new Date(today),
        f, p,
        name,
        start,
        meta;

    p = past.toJSON().slice(0, 10);
    f = future.toJSON().slice(0, 10);
    loading.innerHTML = '<p>Loading...</p>';
    start = domain + '/api/v1/movement' +
        '?orderby=-ends_at&limit=1000&ends_at__range=' + p + ',' + f;
    makeRequests(start, function(data) {
        transformData(data, drawData);
    });
})();

function makeRequests(url, cb, data) {
    data = data || [];
    request(url, function(err, resp, xhr) {
        resp = JSON.parse(resp);
        meta = resp.meta;
        data = data.concat(resp.data);
        loading.innerHTML = '<p>Loading...' +
            Math.round((data.length / meta.count) * 100) + '% complete</p>';
        loading.innerHTML += '<div title="progress" style="' +
            'height:1rem;border-radius:0.5rem;background:lightgrey;' +
            'width:' + ((data.length / meta.count) * 100) + '%' +
            '"></div>';
        if (meta.next) {
            makeRequests(domain + meta.next, cb, data);
        } else {
            cb(data);
        }
    });
}

function transformData(data, cb) {
    var results = [],
        item, type,
        d, i, dDate, cDate;

    for (i = 0; i < data.length; i++) {
        item = data[i];
        dDate = new Date(item.ends_at);
        cDate = new Date(item.created_at);
        d = dDate.toJSON().slice(0, 10);
        if (cDate < future && cDate > past)
            results.push({
                category:   'Movements launched',
                quantity:   1,
                date:       cDate.toJSON().slice(0, 10)
            });
        results.push({
            category:   'Movements ending',
            quantity:   1,
            date:       d
        });
        results.push({
            category:   'Total Units going to production',
            quantity:   item.sold,
            date:       pushToWeekDay(d)
        });
        type = 'DTG units estimate';
        results.push({
            category:   type,
            quantity:   item.sold >= 13 ? item.sold : 0,
            date:       pushToWeekDay(d)
        });
        type = 'SCR units estimate';
        results.push({
            category:   type,
            quantity:   item.sold >= 13 ? 0 : item.sold,
            date:       pushToWeekDay(d)
        });
        if (false)
            results.push({
                category:   'Profit',
                quantity:   item.profit / 100,
                date:       d
            });
    }

    cb(results);
}

function pushToWeekDay(date, d) {
    if (!date.getDay)
        date = new Date(date);
    d = date.getUTCDay();
    if (d > 5) {
        date = new Date(date.getTime() + (DAYLENGTH * 2));
    } else if (d < 1) {
        date = new Date(date.getTime() + DAYLENGTH);
    }

    return date.toJSON().slice(0, 10);
}

function request(url, cb, method, post, contenttype) {
    var requestTimeout, xhr;
    try {
        xhr = new XMLHttpRequest();
    } catch (e) {
        try {
            xhr = new ActiveXObject("Msxml2.XMLHTTP");
        } catch (error) {
            if (console) console.log("_.request: XMLHttpRequest not supported");
            return null;
        }
    }
    requestTimeout = setTimeout(function() {
        xhr.abort();
        cb(new Error("_.request: aborted by timeout"), "", xhr);
    }, 10000);
    xhr.onreadystatechange = function(){
        if (xhr.readyState != 4) return;
        clearTimeout(requestTimeout);
        cb(xhr.status != 200 ?
            new Error("_.request: server respnse status is " + xhr.status) :
            false, xhr.responseText, xhr);
    };
    xhr.open(method ? method.toUpperCase() : "GET", url, true);
    if (!post) {
        xhr.send();
    } else {
        xhr.setRequestHeader(
            'Content-type',
            contenttype ? contenttype : 'application/x-www-form-urlencoded');
        xhr.send(post);
    }
}
